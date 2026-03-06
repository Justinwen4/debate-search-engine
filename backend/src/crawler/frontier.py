"""
Redis-backed URL frontier using a sorted set for priority ordering
and a regular set for deduplication.

Sorted set scores represent priority (lower = higher priority).
The seen set prevents re-crawling the same URL.
"""

import redis.asyncio as redis

from src.config import settings

QUEUE_KEY = "crawler:frontier"
SEEN_KEY = "crawler:seen"


class URLFrontier:
    def __init__(self, redis_url: str | None = None):
        self._redis = redis.from_url(redis_url or settings.redis_url)

    async def add(self, url: str, priority: float = 0.0) -> bool:
        """Add a URL if not already seen. Returns True if newly added."""
        was_new = await self._redis.sadd(SEEN_KEY, url)
        if was_new:
            await self._redis.zadd(QUEUE_KEY, {url: priority})
            return True
        return False

    async def add_many(self, urls: list[str], priority: float = 0.0) -> int:
        """Add multiple URLs. Returns how many were new."""
        count = 0
        pipe = self._redis.pipeline()
        for url in urls:
            pipe.sadd(SEEN_KEY, url)
        results = await pipe.execute()

        to_add = {}
        for url, was_new in zip(urls, results):
            if was_new:
                to_add[url] = priority
                count += 1

        if to_add:
            await self._redis.zadd(QUEUE_KEY, to_add)
        return count

    async def pop(self) -> str | None:
        """Pop the highest-priority (lowest-score) URL."""
        result = await self._redis.zpopmin(QUEUE_KEY, count=1)
        if result:
            url_bytes, _score = result[0]
            return url_bytes.decode() if isinstance(url_bytes, bytes) else url_bytes
        return None

    async def size(self) -> int:
        return await self._redis.zcard(QUEUE_KEY)

    async def seen_count(self) -> int:
        return await self._redis.scard(SEEN_KEY)

    async def clear(self) -> None:
        await self._redis.delete(QUEUE_KEY, SEEN_KEY)

    async def close(self) -> None:
        await self._redis.aclose()
