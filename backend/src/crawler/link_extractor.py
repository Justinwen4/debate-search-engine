"""
Link extraction and URL normalization.

Parses HTML to discover outbound links, filters them by domain and scheme,
and normalizes URLs to avoid crawling duplicates.
"""

from __future__ import annotations

from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

ALLOWED_SCHEMES = frozenset({"http", "https"})
IGNORED_EXTENSIONS = frozenset({
    ".jpg", ".jpeg", ".png", ".gif", ".svg", ".ico", ".webp",
    ".css", ".js", ".woff", ".woff2", ".ttf", ".eot",
    ".mp3", ".mp4", ".avi", ".mov", ".zip", ".tar", ".gz",
})


def normalize_url(url: str) -> str:
    """Lowercase scheme/host, strip fragment, collapse trailing slashes."""
    parsed = urlparse(url)
    scheme = parsed.scheme.lower()
    netloc = parsed.netloc.lower()
    path = parsed.path.rstrip("/") or "/"
    query = parsed.query
    normalized = f"{scheme}://{netloc}{path}"
    if query:
        normalized += f"?{query}"
    return normalized


def extract_links(
    html: str,
    base_url: str,
    allowed_domains: set[str],
) -> list[str]:
    """
    Extract, resolve, filter, and deduplicate links from an HTML document.

    Returns only http(s) links whose host is in *allowed_domains* and whose
    path does not end with a static-asset extension.
    """
    soup = BeautifulSoup(html, "lxml")
    seen: set[str] = set()
    results: list[str] = []

    for anchor in soup.find_all("a", href=True):
        href: str = anchor["href"].strip()
        if not href or href.startswith(("javascript:", "mailto:", "tel:")):
            continue

        absolute = urljoin(base_url, href)
        parsed = urlparse(absolute)

        if parsed.scheme not in ALLOWED_SCHEMES:
            continue
        if parsed.netloc.lower() not in allowed_domains:
            continue

        lower_path = parsed.path.lower()
        if any(lower_path.endswith(ext) for ext in IGNORED_EXTENSIONS):
            continue

        clean = normalize_url(absolute)
        if clean not in seen:
            seen.add(clean)
            results.append(clean)

    return results
