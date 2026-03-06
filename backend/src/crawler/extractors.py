"""
HTML text extraction. Pulls title, author, date, and body text
from an HTML document, targeting content-bearing elements and
discarding boilerplate (nav, footer, ads, etc.).
"""

from __future__ import annotations

from dataclasses import dataclass

from bs4 import BeautifulSoup

STRIP_TAGS = {"script", "style", "nav", "footer", "header", "aside", "iframe", "form"}
CONTENT_TAGS = {"p", "h2", "h3", "h4", "h5", "li", "blockquote", "td"}
MIN_PARAGRAPH_LENGTH = 25


@dataclass(frozen=True)
class ExtractedDocument:
    title: str
    author: str | None
    published_date: str | None
    text: str


def extract_from_html(html: str, url: str) -> ExtractedDocument:
    soup = BeautifulSoup(html, "lxml")

    for tag in soup.find_all(STRIP_TAGS):
        tag.decompose()

    return ExtractedDocument(
        title=_extract_title(soup),
        author=_extract_author(soup),
        published_date=_extract_date(soup),
        text=_extract_body(soup),
    )


def _extract_title(soup: BeautifulSoup) -> str:
    for strategy in [
        lambda: soup.find("meta", property="og:title"),
        lambda: soup.find("meta", attrs={"name": "title"}),
    ]:
        tag = strategy()
        if tag and tag.get("content"):
            return tag["content"].strip()

    title_tag = soup.find("title")
    if title_tag and title_tag.string:
        return title_tag.string.strip()

    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)

    return "Untitled"


def _extract_author(soup: BeautifulSoup) -> str | None:
    for attr_dict in [
        {"attrs": {"name": "author"}},
        {"property": "article:author"},
    ]:
        tag = soup.find("meta", **attr_dict)
        if tag and tag.get("content"):
            return tag["content"].strip()
    return None


def _extract_date(soup: BeautifulSoup) -> str | None:
    for prop in ("article:published_time", "og:published_time"):
        tag = soup.find("meta", property=prop)
        if tag and tag.get("content"):
            return tag["content"].strip()

    meta = soup.find("meta", attrs={"name": "date"})
    if meta and meta.get("content"):
        return meta["content"].strip()

    time_tag = soup.find("time", attrs={"datetime": True})
    if time_tag:
        return time_tag["datetime"]

    return None


def _extract_body(soup: BeautifulSoup) -> str:
    root = soup.find("article") or soup.find("main") or soup.find("body")
    if not root:
        return ""

    paragraphs: list[str] = []
    for el in root.find_all(CONTENT_TAGS):
        text = el.get_text(separator=" ", strip=True)
        if len(text) >= MIN_PARAGRAPH_LENGTH:
            paragraphs.append(text)

    return "\n\n".join(paragraphs)
