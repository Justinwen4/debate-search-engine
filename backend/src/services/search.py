"""
Semantic search over the chunk vector index using pgvector's
cosine distance operator (<=>).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.pipeline.embeddings import get_embedding_service


@dataclass
class SearchResult:
    chunk_id: str
    content: str
    score: float
    source_url: str
    source_title: str
    source_author: str | None
    published_date: str | None


SEARCH_SQL = text("""
    SELECT
        c.id,
        c.content,
        1 - (c.embedding <=> :embedding ::vector) AS score,
        s.url,
        s.title,
        s.author,
        s.published_date
    FROM chunks c
    JOIN sources s ON c.source_id = s.id
    WHERE s.status = 'processed'
    ORDER BY c.embedding <=> :embedding ::vector
    LIMIT :limit
""")


async def semantic_search(
    query: str,
    session: AsyncSession,
    limit: int = 20,
) -> list[SearchResult]:
    embedder = get_embedding_service()
    query_vec = embedder.embed_query(query)
    embedding_literal = "[" + ",".join(str(v) for v in query_vec) + "]"

    rows = await session.execute(
        SEARCH_SQL,
        {"embedding": embedding_literal, "limit": limit},
    )

    return [
        SearchResult(
            chunk_id=str(r.id),
            content=r.content,
            score=float(r.score),
            source_url=r.url,
            source_title=r.title or "Untitled",
            source_author=r.author,
            published_date=r.published_date,
        )
        for r in rows
    ]
