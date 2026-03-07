"""
Hybrid search over the chunk vector index using Reciprocal Rank Fusion (RRF)
of pgvector cosine search and PostgreSQL full-text search.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.pipeline.embeddings import get_embedding_service

RRF_K = 60

DATE_RANGE_DAYS: dict[str, int] = {
    "week": 7,
    "month": 30,
    "year": 365,
    "5years": 1825,
}


@dataclass
class SearchResult:
    chunk_id: str
    content: str
    score: float
    source_url: str
    source_title: str
    source_author: str | None
    published_date: str | None
    source_type: str | None


HYBRID_SQL = text("""
    WITH vector_search AS (
        SELECT
            c.id,
            c.content,
            s.url, s.title, s.author, s.published_date, s.source_type,
            1 - (c.embedding <=> :embedding::vector)  AS vec_score,
            ROW_NUMBER() OVER (
                ORDER BY c.embedding <=> :embedding::vector
            )                                          AS vec_rank
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        WHERE s.status = 'processed'
          AND (:source_type IS NULL OR s.source_type = :source_type)
          AND (:date_from IS NULL  OR s.published_date >= :date_from)
        ORDER BY c.embedding <=> :embedding::vector
        LIMIT :fetch_limit
    ),
    text_search AS (
        SELECT
            c.id,
            ts_rank_cd(
                to_tsvector('english', c.content),
                plainto_tsquery('english', :query)
            )                                          AS text_score,
            ROW_NUMBER() OVER (
                ORDER BY ts_rank_cd(
                    to_tsvector('english', c.content),
                    plainto_tsquery('english', :query)
                ) DESC
            )                                          AS text_rank
        FROM chunks c
        JOIN sources s ON c.source_id = s.id
        WHERE s.status = 'processed'
          AND to_tsvector('english', c.content) @@
              plainto_tsquery('english', :query)
          AND (:source_type IS NULL OR s.source_type = :source_type)
          AND (:date_from IS NULL  OR s.published_date >= :date_from)
        LIMIT :fetch_limit
    ),
    fused AS (
        SELECT
            COALESCE(v.id, t.id)          AS id,
            COALESCE(1.0 / (60 + v.vec_rank),  0)
          + COALESCE(1.0 / (60 + t.text_rank), 0) AS rrf_score
        FROM vector_search v
        FULL OUTER JOIN text_search t ON v.id = t.id
    )
    SELECT
        v.id, v.content, v.url, v.title, v.author, v.published_date,
        v.source_type, f.rrf_score AS score
    FROM fused f
    JOIN vector_search v ON f.id = v.id
    WHERE f.rrf_score >= :min_score
    ORDER BY f.rrf_score DESC
    LIMIT :limit
""")


def _resolve_date_from(date_range: str) -> str | None:
    days = DATE_RANGE_DAYS.get(date_range)
    if days is None:
        return None
    return (date.today() - timedelta(days=days)).isoformat()


async def semantic_search(
    query: str,
    session: AsyncSession,
    *,
    limit: int = 20,
    source_type: str | None = None,
    date_range: str = "any",
    min_score: float = 0.0,
) -> list[SearchResult]:
    embedder = get_embedding_service()
    query_vec = embedder.embed_query(query)
    embedding_literal = "[" + ",".join(str(v) for v in query_vec) + "]"

    date_from = _resolve_date_from(date_range)

    rows = await session.execute(
        HYBRID_SQL,
        {
            "embedding": embedding_literal,
            "query": query,
            "limit": limit,
            "fetch_limit": limit * 4,
            "source_type": source_type,
            "date_from": date_from,
            "min_score": min_score,
        },
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
            source_type=r.source_type,
        )
        for r in rows
    ]
