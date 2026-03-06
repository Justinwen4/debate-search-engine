from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/debate_search"
    redis_url: str = "redis://localhost:6379/0"

    embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimensions: int = 384

    crawler_concurrency: int = 5
    crawler_delay: float = 1.0
    crawler_user_agent: str = "DebateSearchBot/1.0"

    chunk_max_words: int = 512
    chunk_overlap_words: int = 64

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
