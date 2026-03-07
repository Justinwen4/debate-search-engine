"""
Async crawl engine with a fixed-size worker pool.

Architecture
────────────
                      ┌──────────────┐
          seeds ────► │ asyncio.Queue│
                      └──────┬───────┘
               ┌─────────┬──┴──┬─────────┐
               ▼         ▼     ▼         ▼
           worker-0  worker-1  …  worker-N
               │         │     │         │
               ▼         ▼     ▼         ▼
          fetch → process → discover → enqueue
                                        ▲
                                        │
                               (same-domain links
                                within depth limit)

Workers pull CrawlTasks from the queue, fetch the page (HTML or PDF),
run the ingestion pipeline, extract outbound links, and feed them back
into the queue.  An in-memory seen set prevents duplicate visits.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from urllib.parse import urlparse

import aiohttp
from sqlalchemy import select

from src.config import settings
from src.crawler.extractors import extract_from_pdf
from src.crawler.link_extractor import extract_links, normalize_url
from src.crawler.robots import RobotsChecker
from src.database import async_session_factory
from src.models import Source, SourceStatus
from src.pipeline.processor import process_source

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------

@dataclass
class CrawlTask:
    url: str
    depth: int


@dataclass
class CrawlStats:
    """Mutable crawl-session counters."""

    crawled: int = 0
    skipped: int = 0
    errors: int = 0
    pdfs: int = 0
    _start: float = field(default_factory=time.monotonic, repr=False)

    @property
    def elapsed(self) -> float:
        return time.monotonic() - self._start

    def summary(self) -> str:
        return (
            f"crawled={self.crawled}  skipped={self.skipped}  "
            f"errors={self.errors}  pdfs={self.pdfs}  "
            f"elapsed={self.elapsed:.1f}s"
        )


# ---------------------------------------------------------------------------
# Crawl engine
# ---------------------------------------------------------------------------

class CrawlEngine:
    """
    Manages an async crawl session: URL queue, worker pool, dedup,
    depth limiting, and progress reporting.
    """

    def __init__(
        self,
        allowed_domains: set[str],
        *,
        max_depth: int = settings.crawler_max_depth,
        concurrency: int = settings.crawler_concurrency,
        delay: float = settings.crawler_delay,
    ) -> None:
        self._allowed_domains = {d.lower() for d in allowed_domains}
        self._max_depth = max_depth
        self._concurrency = concurrency
        self._delay = delay

        self._queue: asyncio.Queue[CrawlTask] = asyncio.Queue()
        self._seen: set[str] = set()
        self._stats = CrawlStats()
        self._robots = RobotsChecker(settings.crawler_user_agent)

    # -- public API ---------------------------------------------------------

    def enqueue(self, url: str, depth: int = 0) -> bool:
        """Add *url* to the work queue if eligible (unseen, in-domain, within depth)."""
        normalized = normalize_url(url)
        if normalized in self._seen:
            return False
        if depth > self._max_depth:
            return False

        parsed = urlparse(normalized)
        if parsed.netloc.lower() not in self._allowed_domains:
            return False

        self._seen.add(normalized)
        self._queue.put_nowait(CrawlTask(url=normalized, depth=depth))
        return True

    async def run(self, seeds: list[str]) -> CrawlStats:
        """Seed the queue, start workers, and block until crawling finishes."""
        for url in seeds:
            self.enqueue(url, depth=0)

        if self._queue.empty():
            logger.warning("No valid seed URLs — nothing to crawl")
            return self._stats

        logger.info(
            "Starting crawl: seeds=%d  concurrency=%d  max_depth=%d  domains=%s",
            self._queue.qsize(),
            self._concurrency,
            self._max_depth,
            self._allowed_domains,
        )

        connector = aiohttp.TCPConnector(limit=self._concurrency, limit_per_host=5)
        timeout = aiohttp.ClientTimeout(total=30)
        headers = {"User-Agent": settings.crawler_user_agent}

        async with aiohttp.ClientSession(
            connector=connector, timeout=timeout, headers=headers,
        ) as http:
            workers = [
                asyncio.create_task(self._worker(wid, http))
                for wid in range(self._concurrency)
            ]

            await self._queue.join()

            for w in workers:
                w.cancel()
            await asyncio.gather(*workers, return_exceptions=True)

        logger.info("Crawl complete — %s", self._stats.summary())
        return self._stats

    # -- worker loop --------------------------------------------------------

    async def _worker(self, worker_id: int, http: aiohttp.ClientSession) -> None:
        while True:
            task = await self._queue.get()
            try:
                await self._process_task(task, http)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Worker-%d failed on %s", worker_id, task.url)
                self._stats.errors += 1
            finally:
                self._queue.task_done()

            if self._delay > 0:
                await asyncio.sleep(self._delay)

    # -- fetch & process ----------------------------------------------------

    async def _process_task(
        self, task: CrawlTask, http: aiohttp.ClientSession,
    ) -> None:
        url = task.url

        if not await self._robots.is_allowed(url, http):
            self._stats.skipped += 1
            logger.debug("Blocked by robots.txt: %s", url)
            return

        try:
            async with http.get(url, allow_redirects=True) as resp:
                if resp.status != 200:
                    self._stats.errors += 1
                    logger.warning("HTTP %d — %s", resp.status, url)
                    return

                content_type = resp.headers.get("Content-Type", "")

                if "application/pdf" in content_type or url.lower().endswith(".pdf"):
                    await self._handle_pdf(url, resp)
                    return

                if "text/html" not in content_type:
                    self._stats.skipped += 1
                    return

                html = await resp.text()

        except (aiohttp.ClientError, asyncio.TimeoutError) as exc:
            self._stats.errors += 1
            logger.warning("Network error fetching %s: %s", url, exc)
            return

        await self._handle_html(url, html, task.depth)

    # -- HTML ---------------------------------------------------------------

    async def _handle_html(self, url: str, html: str, depth: int) -> None:
        domain = urlparse(url).netloc

        async with async_session_factory() as session:
            existing = await session.execute(
                select(Source.id).where(Source.url == url)
            )
            if existing.scalar_one_or_none() is not None:
                self._stats.skipped += 1
                return

            source = Source(
                url=url,
                domain=domain,
                raw_html=html,
                status=SourceStatus.CRAWLED,
            )
            session.add(source)
            await session.commit()
            await session.refresh(source)

            await process_source(source, session)

        self._stats.crawled += 1

        if depth < self._max_depth:
            links = extract_links(html, url, self._allowed_domains)
            enqueued = sum(1 for link in links if self.enqueue(link, depth + 1))
            if enqueued:
                logger.debug("Discovered %d new links from %s", enqueued, url)

        self._log_progress(url)

    # -- PDF ----------------------------------------------------------------

    async def _handle_pdf(self, url: str, resp: aiohttp.ClientResponse) -> None:
        pdf_bytes = await resp.read()
        domain = urlparse(url).netloc

        doc = await asyncio.to_thread(extract_from_pdf, pdf_bytes, url)

        async with async_session_factory() as session:
            existing = await session.execute(
                select(Source.id).where(Source.url == url)
            )
            if existing.scalar_one_or_none() is not None:
                self._stats.skipped += 1
                return

            source = Source(
                url=url,
                domain=domain,
                title=doc.title,
                author=doc.author,
                published_date=doc.published_date,
                extracted_text=doc.text,
                status=SourceStatus.CRAWLED,
            )
            session.add(source)
            await session.commit()
            await session.refresh(source)

            await process_source(source, session)

        self._stats.pdfs += 1
        self._stats.crawled += 1
        self._log_progress(url)

    # -- logging ------------------------------------------------------------

    def _log_progress(self, url: str) -> None:
        if self._stats.crawled % 10 == 0:
            logger.info(
                "Progress — %s  queue=%d  seen=%d",
                self._stats.summary(),
                self._queue.qsize(),
                len(self._seen),
            )
        else:
            logger.info("Crawled: %s  (depth-capacity remaining)", url)
