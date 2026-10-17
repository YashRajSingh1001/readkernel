"""Settings read from environment variables (and .env files)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

PIPELINE_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = PIPELINE_DIR.parent

load_dotenv(REPO_DIR / ".env")
load_dotenv(PIPELINE_DIR / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, "").strip() or default


@dataclass(frozen=True)
class Settings:
    llm_provider: str
    groq_api_key: str
    groq_model: str
    anthropic_api_key: str
    anthropic_model: str
    openai_api_key: str
    openai_model: str
    max_age_hours: int
    stories_per_brief: int
    embeddings: str
    timezone: ZoneInfo
    supabase_url: str
    supabase_secret_key: str
    site_url: str
    email_transport: str
    email_from: str
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    resend_api_key: str
    send_per_minute: int
    sources_file: Path
    data_dir: Path


def load_settings() -> Settings:
    return Settings(
        llm_provider=_env("LLM_PROVIDER", "groq").lower(),
        groq_api_key=_env("GROQ_API_KEY"),
        groq_model=_env("GROQ_MODEL", "openai/gpt-oss-120b"),
        anthropic_api_key=_env("ANTHROPIC_API_KEY"),
        anthropic_model=_env("ANTHROPIC_MODEL", "claude-haiku-5-5"),
        openai_api_key=_env("OPENAI_API_KEY"),
        openai_model=_env("OPENAI_MODEL", "gpt-5-mini"),
        max_age_hours=int(_env("MAX_AGE_HOURS", "36")),
        stories_per_brief=int(_env("STORIES_PER_BRIEF", "10")),
        embeddings=_env("EMBEDDINGS", "local").lower(),
        timezone=ZoneInfo(_env("TIMEZONE", "Asia/Kolkata")),
        supabase_url=_env("SUPABASE_URL"),
        supabase_secret_key=_env("SUPABASE_SECRET_KEY"),
        site_url=_env("SITE_URL", "http://localhost:3000").rstrip("/"),
        email_transport=_env("EMAIL_TRANSPORT", "preview").lower(),
        email_from=_env("EMAIL_FROM"),
        smtp_host=_env("SMTP_HOST"),
        smtp_port=int(_env("SMTP_PORT", "587")),
        smtp_user=_env("SMTP_USER"),
        smtp_password=_env("SMTP_PASSWORD"),
        resend_api_key=_env("RESEND_API_KEY"),
        send_per_minute=int(_env("SEND_PER_MINUTE", "20")),
        sources_file=Path(_env("SOURCES_FILE", str(PIPELINE_DIR / "sources.yaml"))),
        data_dir=Path(_env("DATA_DIR", str(PIPELINE_DIR / "data"))),
    )
