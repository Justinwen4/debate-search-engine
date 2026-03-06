"""
CLI entry point for the debate search engine backend.

Usage:
    python cli.py serve                        # start the API server
    python cli.py crawl URL1 URL2 ...          # crawl from seed URLs
    python cli.py crawl URL -d extra.domain    # allow additional domains
"""

import asyncio
import logging

import click

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


@click.group()
def cli():
    """Debate Search Engine — backend CLI."""


@cli.command()
@click.option("--host", default="0.0.0.0", help="Bind address")
@click.option("--port", default=8000, help="Port number")
@click.option("--reload", is_flag=True, help="Auto-reload on code changes")
def serve(host: str, port: int, reload: bool):
    """Start the FastAPI server."""
    import uvicorn

    uvicorn.run("src.api.main:app", host=host, port=port, reload=reload)


@cli.command()
@click.argument("urls", nargs=-1, required=True)
@click.option(
    "-d", "--domain", "extra_domains", multiple=True,
    help="Additional domains to allow crawling (seed URL domains are always allowed)",
)
def crawl(urls: tuple[str, ...], extra_domains: tuple[str, ...]):
    """Crawl from one or more seed URLs."""
    from urllib.parse import urlparse

    from src.crawler.worker import CrawlerWorker

    allowed = set(extra_domains)
    for u in urls:
        allowed.add(urlparse(u).netloc)

    worker = CrawlerWorker(allowed_domains=list(allowed))

    async def _run():
        await worker.seed(list(urls))
        await worker.run()

    asyncio.run(_run())


if __name__ == "__main__":
    cli()
