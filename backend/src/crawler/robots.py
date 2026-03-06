"""
Async robots.txt checker. Fetches and caches robots.txt per domain,
then checks whether a URL is allowed for our user-agent.
"""

from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import aiohttp


class RobotsChecker:
    def __init__(self, user_agent: str):
        self.user_agent = user_agent
        self._cache: dict[str, RobotFileParser] = {}

    async def is_allowed(self, url: str, session: aiohttp.ClientSession) -> bool:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        if origin not in self._cache:
            parser = RobotFileParser()
            robots_url = f"{origin}/robots.txt"
            try:
                timeout = aiohttp.ClientTimeout(total=10)
                async with session.get(robots_url, timeout=timeout) as resp:
                    if resp.status == 200:
                        text = await resp.text()
                        parser.parse(text.splitlines())
                    else:
                        parser.allow_all = True
            except Exception:
                parser.allow_all = True
            self._cache[origin] = parser

        return self._cache[origin].can_fetch(self.user_agent, url)
