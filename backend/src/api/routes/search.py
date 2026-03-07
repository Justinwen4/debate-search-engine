from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.services.search import semantic_search

router = APIRouter()


class PassageResult(BaseModel):
    chunk_id: str
    content: str
    score: float
    source_url: str
    source_title: str
    source_author: str | None
    published_date: str | None
    source_type: str | None


class SearchResponse(BaseModel):
    query: str
    results: list[PassageResult]
    count: int


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, description="Semantic search query"),
    limit: int = Query(20, ge=1, le=100, description="Max results"),
    source_type: str | None = Query(None, description="Filter by source type"),
    date_range: str = Query("any", description="Date range filter"),
    min_score: float = Query(0.0, ge=0.0, le=1.0, description="Minimum RRF score"),
    session: AsyncSession = Depends(get_session),
):
    results = await semantic_search(
        q,
        session,
        limit=limit,
        source_type=source_type,
        date_range=date_range,
        min_score=min_score,
    )

    return SearchResponse(
        query=q,
        results=[
            PassageResult(
                chunk_id=r.chunk_id,
                content=r.content,
                score=r.score,
                source_url=r.source_url,
                source_title=r.source_title,
                source_author=r.source_author,
                published_date=r.published_date,
                source_type=r.source_type,
            )
            for r in results
        ],
        count=len(results),
    )
