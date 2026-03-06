"""
Document processing pipeline: extract text from HTML, chunk it,
generate embeddings, and store everything in PostgreSQL.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.crawler.extractors import extract_from_html
from src.models import Chunk, Source, SourceStatus
from src.pipeline.chunker import chunk_document
from src.pipeline.embeddings import get_embedding_service

logger = logging.getLogger(__name__)


async def process_source(source: Source, session: AsyncSession) -> int:
    """
    Run the full pipeline on a crawled source.
    Returns the number of chunks created, or 0 on failure.
    """
    try:
        doc = extract_from_html(source.raw_html, source.url)

        source.title = doc.title
        source.author = doc.author
        source.published_date = doc.published_date
        source.extracted_text = doc.text

        if not doc.text or len(doc.text.split()) < 30:
            logger.warning("Skipping %s: too little text extracted", source.url)
            source.status = SourceStatus.FAILED
            await session.commit()
            return 0

        text_chunks = chunk_document(
            doc.text,
            max_words=settings.chunk_max_words,
            overlap_words=settings.chunk_overlap_words,
            source_title=doc.title,
        )

        if not text_chunks:
            source.status = SourceStatus.FAILED
            await session.commit()
            return 0

        embedder = get_embedding_service()
        embeddings = embedder.embed_texts([c.content for c in text_chunks])

        for tc, emb in zip(text_chunks, embeddings):
            session.add(
                Chunk(
                    source_id=source.id,
                    chunk_index=tc.index,
                    content=tc.content,
                    embedding=emb,
                    meta=tc.metadata,
                )
            )

        source.status = SourceStatus.PROCESSED
        await session.commit()
        logger.info("Processed %s → %d chunks", source.url, len(text_chunks))
        return len(text_chunks)

    except Exception:
        logger.exception("Failed to process %s", source.url)
        source.status = SourceStatus.FAILED
        await session.commit()
        return 0
