"""
Async crawler worker. Pulls URLs from the Redis frontier, fetches pages,
stores raw HTML, runs the processing pipeline, and discovers new links.
"""

from __future__ import annotations

import asyncio
import logging
from urllib.parse import urljoin, urlparse

import aiohttp
from bs4 import BeautifulSoup
from sqlalchemy import select

from src.config import settings
from src.crawler.frontier import URLFrontier
from src.crawler.robots import RobotsChecker
from src.database import async_session_factory
from src.models import Source, SourceStatus
from src.pipeline.processor import process_source

logger = logging.getLogger(__name__)


class CrawlerWorker:
    def __init__(self, allowed_domains: list[str]):
        self.allowed_domains = set(allowed_domains)
        self.frontier = URLFrontier()
        self.robots = RobotsChecker(settings.crawler_user_agent)
        self.concurrency = settings.crawler_concurrency
        self.delay = settings.crawler_delay

    async def seed(self, urls: list[str]) -> None:
        added = await self.frontier.add_many(urls)
        logger.info("Seeded frontier with %d new URLs (of %d provided)", added, len(urls))

    async def run(self) -> None:
        connector = aiohttp.TCPConnector(limit=self.concurrency)
        timeout = aiohttp.ClientTimeout(total=30)
        headers = {"User-Agent": settings.crawler_user_agent}

        async with aiohttp.ClientSession(
            connector=connector, timeout=timeout, headers=headers
        ) as http:
            active: set[asyncio.Task] = set()

            while True:
                # Fill up to concurrency limit
                while len(active) < self.concurrency:
                    url = await self.frontier.pop()
                    if url is None:
                        break
                    task = asyncio.create_task(self._fetch_and_process(url, http))
                    active.add(task)
                    task.add_done_callback(active.discard)

                if not active:
                    remaining = await self.frontier.size()
                    if remaining == 0:
                        logger.info("Frontier exhausted — stopping crawler")
                        break

                if active:
                    await asyncio.wait(active, return_when=asyncio.FIRST_COMPLETED)

                await asyncio.sleep(self.delay)

        await self.frontier.close()
        seen = await self.frontier.seen_count()
        logger.info("Crawl complete. Total URLs seen: %d", seen)

    async def _fetch_and_process(self, url: str, http: aiohttp.ClientSession) -> None:
        try:
            if not await self.robots.is_allowed(url, http):
                logger.debug("Blocked by robots.txt: %s", url)
                return

            async with http.get(url) as resp:
                if resp.status != 200:
                    logger.warning("HTTP %d for %s", resp.status, url)
                    return

                content_type = resp.headers.get("Content-Type", "")
                if "text/html" not in content_type:
                    return

                html = await resp.text()

            domain = urlparse(url).netloc

            async with async_session_factory() as session:
                existing = await session.execute(
                    select(Source.id).where(Source.url == url)
                )
                if existing.scalar_one_or_none() is not None:
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

            await self._discover_links(html, url)
            logger.info("Crawled: %s", url)

        except Exception:
            logger.exception("Error crawling %s", url)

    async def _discover_links(self, html: str, base_url: str) -> None:
        soup = BeautifulSoup(html, "lxml")

        for anchor in soup.find_all("a", href=True):
            href = anchor["href"]
            absolute = urljoin(base_url, href)
            parsed = urlparse(absolute)

            if parsed.scheme not in ("http", "https"):
                continue
            if parsed.netloc not in self.allowed_domains:
                continue

            clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            await self.frontier.add(clean)
