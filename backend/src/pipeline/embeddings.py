"""
Embedding service wrapping sentence-transformers.
Uses a singleton so the model is loaded once and reused.
"""

from __future__ import annotations

import logging
from threading import Lock

from sentence_transformers import SentenceTransformer

from src.config import settings

logger = logging.getLogger(__name__)

_lock = Lock()
_instance: EmbeddingService | None = None


class EmbeddingService:
    def __init__(self, model_name: str | None = None):
        name = model_name or settings.embedding_model
        logger.info("Loading embedding model: %s", name)
        self.model = SentenceTransformer(name)
        self.dimensions = settings.embedding_dimensions

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        vectors = self.model.encode(texts, normalize_embeddings=True)
        return vectors.tolist()

    def embed_query(self, query: str) -> list[float]:
        return self.embed_texts([query])[0]


def get_embedding_service() -> EmbeddingService:
    global _instance
    if _instance is None:
        with _lock:
            if _instance is None:
                _instance = EmbeddingService()
    return _instance
