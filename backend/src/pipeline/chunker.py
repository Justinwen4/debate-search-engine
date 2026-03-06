"""
Paragraph-aware text chunker. Splits on double-newlines (paragraph breaks)
and groups paragraphs into chunks of roughly `max_words` with overlap
to preserve context across chunk boundaries.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class TextChunk:
    index: int
    content: str
    word_count: int
    metadata: dict = field(default_factory=dict)


def chunk_document(
    text: str,
    *,
    max_words: int = 512,
    overlap_words: int = 64,
    source_title: str = "",
) -> list[TextChunk]:
    """
    Split text into overlapping chunks at paragraph boundaries.

    Each chunk targets ~max_words. Overlap retains trailing paragraphs
    from the previous chunk so cross-boundary passages aren't lost.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    if not paragraphs:
        return []

    chunks: list[TextChunk] = []
    buf: list[str] = []
    buf_words = 0
    idx = 0

    for para in paragraphs:
        pw = len(para.split())

        if buf_words + pw > max_words and buf:
            chunks.append(_make_chunk(buf, idx, source_title))
            idx += 1

            # Carry over tail paragraphs as overlap
            overlap_buf: list[str] = []
            overlap_count = 0
            for p in reversed(buf):
                p_words = len(p.split())
                if overlap_count + p_words > overlap_words:
                    break
                overlap_buf.insert(0, p)
                overlap_count += p_words

            buf = overlap_buf
            buf_words = overlap_count

        buf.append(para)
        buf_words += pw

    if buf:
        chunks.append(_make_chunk(buf, idx, source_title))

    return chunks


def _make_chunk(paragraphs: list[str], index: int, source_title: str) -> TextChunk:
    content = "\n\n".join(paragraphs)
    return TextChunk(
        index=index,
        content=content,
        word_count=len(content.split()),
        metadata={"source_title": source_title, "chunk_index": index},
    )
