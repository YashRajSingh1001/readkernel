from __future__ import annotations

import json
import re
import time

import httpx

from .config import Settings

TIMEOUT = 60.0
MAX_TRIES = 4


class LLM:
    def __init__(self, provider: str, api_key: str, model: str):
        self.provider = provider
        self.api_key = api_key
        self.model = model
        self._client = httpx.Client(timeout=TIMEOUT)
        self.usage = {
            "calls": 0, "calls_without_usage": 0, "input": 0, "cached_input": 0,
            "cache_write": 0, "output": 0, "reasoning": 0,
        }

    def __repr__(self) -> str:
        return f"LLM({self.provider}:{self.model})"

    def json(self, system: str, user: str, max_tokens: int = 700) -> dict | None:
        system = f"{system}\nRespond with a single valid json object."
        for attempt in range(MAX_TRIES):
            try:
                text = self._call(system, user, max_tokens)
                return parse_json_object(text)
            except httpx.HTTPStatusError as exc:
                status = exc.response.status_code
                if status == 429 or status >= 500:
                    wait = _retry_after(exc.response) or 2 ** (attempt + 1)
                    time.sleep(min(wait, 30))
                    continue
                print(f"    [llm] {self.provider} error {status}: {exc.response.text[:200]}")
                return None
            except (httpx.TransportError, ValueError) as exc:
                if attempt == MAX_TRIES - 1:
                    print(f"    [llm] {self.provider} failed: {exc}")
                    return None
                time.sleep(2 ** attempt)
        return None

    def _call(self, system: str, user: str, max_tokens: int) -> str:
        if self.provider == "claude":
            response = self._client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
            )
            response.raise_for_status()
            data = response.json()
            self._add_usage(data.get("usage"))
            blocks = data.get("content", [])
            return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")

        url = (
            "https://api.groq.com/openai/v1/chat/completions"
            if self.provider == "groq"
            else "https://api.openai.com/v1/chat/completions"
        )
        body = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        }
        if self.provider == "groq":
            body["temperature"] = 0.2
            body["max_tokens"] = max_tokens
            if "gpt-oss" in self.model:
                body["reasoning_effort"] = "low"
                body["max_tokens"] = max_tokens * 2
        else:
            body["max_completion_tokens"] = max_tokens * 4
        response = self._client.post(
            url, headers={"Authorization": f"Bearer {self.api_key}"}, json=body
        )
        response.raise_for_status()
        data = response.json()
        self._add_usage(data.get("usage"))
        return data["choices"][0]["message"]["content"] or ""

    def _add_usage(self, usage: dict | None) -> None:
        u = self.usage
        u["calls"] += 1
        if not isinstance(usage, dict):
            u["calls_without_usage"] += 1
            return
        if self.provider == "claude":
            read = usage.get("cache_read_input_tokens") or 0
            write = usage.get("cache_creation_input_tokens") or 0
            u["input"] += (usage.get("input_tokens") or 0) + read + write
            u["cached_input"] += read
            u["cache_write"] += write
            u["output"] += usage.get("output_tokens") or 0
            return
        u["input"] += usage.get("prompt_tokens") or 0
        u["output"] += usage.get("completion_tokens") or 0
        u["cached_input"] += (usage.get("prompt_tokens_details") or {}).get("cached_tokens") or 0
        u["reasoning"] += (usage.get("completion_tokens_details") or {}).get("reasoning_tokens") or 0


def _retry_after(response: httpx.Response) -> float | None:
    value = response.headers.get("retry-after")
    try:
        return float(value) if value else None
    except ValueError:
        return None


def parse_json_object(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.DOTALL)
        if not match:
            raise ValueError("no JSON object in reply")
        value = json.loads(match.group(0))
    if not isinstance(value, dict):
        raise ValueError("reply is not a JSON object")
    return value


def make_llm(settings: Settings) -> LLM | None:
    provider = settings.llm_provider
    options = {
        "groq": (settings.groq_api_key, settings.groq_model, "GROQ_API_KEY"),
        "claude": (settings.anthropic_api_key, settings.anthropic_model, "ANTHROPIC_API_KEY"),
        "openai": (settings.openai_api_key, settings.openai_model, "OPENAI_API_KEY"),
    }
    if provider == "none":
        return None
    if provider not in options:
        raise ValueError(f"LLM_PROVIDER must be groq, claude, openai or none (got '{provider}')")
    key, model, key_name = options[provider]
    if not key:
        print(f"[kernel] {key_name} is not set, running without AI.")
        return None
    return LLM(provider, key, model)
