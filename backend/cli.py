"""
CLI entry point for the debate search engine backend.

Usage:
    python cli.py serve                                  # start the API server
    python cli.py crawl URL1 URL2 ...                    # crawl specific URLs
    python cli.py crawl-file seeds.txt                   # crawl URLs from a file
    python cli.py crawl-domain example.com               # crawl an entire domain
"""

from __future__ import annotations

import asyncio
import logging
import pathlib
from urllib.parse import urlparse

import click

from src.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _domains_from_urls(urls: list[str]) -> set[str]:
    """Extract unique netlocs from a list of URLs."""
    return {urlparse(u).netloc.lower() for u in urls if urlparse(u).netloc}


def _run_crawl(
    seeds: list[str],
    allowed_domains: set[str],
    *,
    max_depth: int,
    concurrency: int,
    delay: float,
) -> None:
    """Instantiate the CrawlEngine and run it to completion."""
    from src.crawler.crawler import CrawlEngine

    engine = CrawlEngine(
        allowed_domains=allowed_domains,
        max_depth=max_depth,
        concurrency=concurrency,
        delay=delay,
    )

    stats = asyncio.run(engine.run(seeds))

    click.echo()
    click.echo(f"  Done — {stats.summary()}")


# ---------------------------------------------------------------------------
# Shared CLI options
# ---------------------------------------------------------------------------

_crawl_options = [
    click.option(
        "-d", "--domain", "extra_domains", multiple=True,
        help="Additional domains to allow (seed-URL domains are always included).",
    ),
    click.option(
        "--depth", "max_depth", default=settings.crawler_max_depth,
        show_default=True, type=int,
        help="Maximum link-follow depth.",
    ),
    click.option(
        "--concurrency", default=settings.crawler_concurrency,
        show_default=True, type=int,
        help="Number of parallel workers.",
    ),
    click.option(
        "--delay", default=settings.crawler_delay,
        show_default=True, type=float,
        help="Seconds to wait between requests per worker.",
    ),
]


def _add_options(options: list):
    """Decorator factory that applies a list of click options."""
    def decorator(func):
        for opt in reversed(options):
            func = opt(func)
        return func
    return decorator


# ---------------------------------------------------------------------------
# CLI group
# ---------------------------------------------------------------------------

@click.group()
def cli():
    """Debate Search Engine — backend CLI."""


# ---------------------------------------------------------------------------
# serve
# ---------------------------------------------------------------------------

@cli.command()
@click.option("--host", default="0.0.0.0", help="Bind address")
@click.option("--port", default=8000, help="Port number")
@click.option("--reload", is_flag=True, help="Auto-reload on code changes")
def serve(host: str, port: int, reload: bool):
    """Start the FastAPI server."""
    import uvicorn

    uvicorn.run("src.api.main:app", host=host, port=port, reload=reload)


# ---------------------------------------------------------------------------
# crawl  <url1> <url2> ...
# ---------------------------------------------------------------------------

@cli.command()
@click.argument("urls", nargs=-1, required=True)
@_add_options(_crawl_options)
def crawl(
    urls: tuple[str, ...],
    extra_domains: tuple[str, ...],
    max_depth: int,
    concurrency: int,
    delay: float,
):
    """Crawl one or more seed URLs."""
    seed_list = list(urls)
    allowed = _domains_from_urls(seed_list) | set(extra_domains)

    click.echo(f"  Seeds:   {len(seed_list)}")
    click.echo(f"  Domains: {allowed}")

    _run_crawl(
        seed_list, allowed,
        max_depth=max_depth, concurrency=concurrency, delay=delay,
    )


# ---------------------------------------------------------------------------
# crawl-file  <path>
# ---------------------------------------------------------------------------

@cli.command("crawl-file")
@click.argument("filepath", type=click.Path(exists=True, dir_okay=False))
@_add_options(_crawl_options)
def crawl_file(
    filepath: str,
    extra_domains: tuple[str, ...],
    max_depth: int,
    concurrency: int,
    delay: float,
):
    """Crawl URLs listed in a text file (one per line)."""
    lines = pathlib.Path(filepath).read_text().splitlines()
    seed_list = [line.strip() for line in lines if line.strip() and not line.startswith("#")]

    if not seed_list:
        raise click.ClickException(f"No URLs found in {filepath}")

    allowed = _domains_from_urls(seed_list) | set(extra_domains)

    click.echo(f"  File:    {filepath}")
    click.echo(f"  Seeds:   {len(seed_list)}")
    click.echo(f"  Domains: {allowed}")

    _run_crawl(
        seed_list, allowed,
        max_depth=max_depth, concurrency=concurrency, delay=delay,
    )


# ---------------------------------------------------------------------------
# crawl-domain  <domain>
# ---------------------------------------------------------------------------

@cli.command("crawl-domain")
@click.argument("domain")
@_add_options(_crawl_options)
def crawl_domain(
    domain: str,
    extra_domains: tuple[str, ...],
    max_depth: int,
    concurrency: int,
    delay: float,
):
    """Crawl all discoverable pages on a domain.

    Starts from https://<domain>/ and follows internal links up to --depth.
    """
    domain = domain.lower().strip("/")
    if domain.startswith(("http://", "https://")):
        parsed = urlparse(domain)
        domain = parsed.netloc

    seed_url = f"https://{domain}/"
    allowed = {domain} | set(extra_domains)

    click.echo(f"  Domain:  {domain}")
    click.echo(f"  Seed:    {seed_url}")
    click.echo(f"  Depth:   {max_depth}")

    _run_crawl(
        [seed_url], allowed,
        max_depth=max_depth, concurrency=concurrency, delay=delay,
    )


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    cli()
