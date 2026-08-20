"""Centralized, agent-agnostic Groq call handling.

Every Groq chat-completion call in the backend (the sandbox agent loop, the
classifier, the scenario generator, and plain-English agent ingestion) goes
through `groq_chat_completion()` instead of calling `client.chat.completions
.create()` directly. This is the single place that:

- limits how many Groq requests are in flight at once (a process-wide
  semaphore), and enforces a minimum gap between consecutive calls, so a
  40-scenario run doesn't burst the account's shared tokens-per-minute
  budget in the first place;
- on a 429, waits for exactly as long as Groq's own error message says to
  ("Please try again in 17.39s"), or the standard `Retry-After` response
  header if present, before retrying;
- falls back to exponential backoff with jitter when no retry timing is
  available, up to a bounded number of attempts;
- raises `GroqRateLimitExceeded` once retries are exhausted, so a caller can
  record a genuine rate-limit failure instead of it masquerading as a
  completed (and therefore possibly "passed"/"failed") scenario.

None of this is specific to any scenario, category, or agent — every knob is
a single process-wide constant, overridable via environment variables.
"""

import os
import random
import re
import threading
import time
from typing import Any

try:
    from groq import RateLimitError
except ImportError:  # pragma: no cover - groq is a hard dependency at call time
    RateLimitError = None  # type: ignore[assignment,misc]


DEFAULT_MAX_RETRIES = int(os.environ.get("GROQ_MAX_RETRIES", "3"))
DEFAULT_BASE_DELAY_SECONDS = float(os.environ.get("GROQ_BASE_DELAY_SECONDS", "2"))
DEFAULT_MAX_DELAY_SECONDS = float(os.environ.get("GROQ_MAX_DELAY_SECONDS", "25"))
MAX_CONCURRENT_REQUESTS = max(1, int(os.environ.get("GROQ_MAX_CONCURRENT_REQUESTS", "1")))
MIN_CALL_INTERVAL_SECONDS = float(os.environ.get("GROQ_MIN_CALL_INTERVAL_SECONDS", "1.0"))

_request_semaphore = threading.Semaphore(MAX_CONCURRENT_REQUESTS)
_pacing_lock = threading.Lock()
_last_call_at = 0.0

_RETRY_AFTER_PATTERN = re.compile(r"try again in ([\d.]+)\s*s", re.IGNORECASE)


class GroqRateLimitExceeded(RuntimeError):
    """A Groq call kept hitting 429 even after exhausting retries."""


def _is_rate_limit_error(error: Exception) -> bool:
    if RateLimitError is not None and isinstance(error, RateLimitError):
        return True
    status_code = getattr(error, "status_code", None)
    if status_code == 429:
        return True
    text = str(error)
    return "429" in text or "rate_limit_exceeded" in text.lower()


def _extract_retry_after_seconds(error: Exception) -> float | None:
    """Best-effort, provider-format-agnostic extraction of how long to wait,
    preferring the server's own guidance over guessing."""
    response = getattr(error, "response", None)
    if response is not None:
        header = getattr(response, "headers", {}).get("retry-after")
        if header:
            try:
                return float(header)
            except ValueError:
                pass

    match = _RETRY_AFTER_PATTERN.search(str(error))
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            pass
    return None


def _wait_for_pacing() -> None:
    """Enforce a minimum gap between consecutive Groq calls, process-wide."""
    global _last_call_at
    with _pacing_lock:
        elapsed = time.monotonic() - _last_call_at
        remaining = MIN_CALL_INTERVAL_SECONDS - elapsed
        if remaining > 0:
            time.sleep(remaining)
        _last_call_at = time.monotonic()


def groq_chat_completion(
    client: Any,
    *,
    max_retries: int = DEFAULT_MAX_RETRIES,
    base_delay: float = DEFAULT_BASE_DELAY_SECONDS,
    max_delay: float = DEFAULT_MAX_DELAY_SECONDS,
    **kwargs: Any,
):
    """Drop-in replacement for `client.chat.completions.create(**kwargs)`
    with centralized concurrency limiting, pacing, and 429 retry handling."""
    last_error: Exception | None = None

    for attempt in range(max_retries + 1):
        with _request_semaphore:
            _wait_for_pacing()
            try:
                return client.chat.completions.create(**kwargs)
            except Exception as error:
                if not _is_rate_limit_error(error):
                    raise
                last_error = error

        if attempt >= max_retries:
            break

        delay = _extract_retry_after_seconds(last_error)
        if delay is None:
            delay = min(max_delay, base_delay * (2**attempt))
        delay += random.uniform(0, delay * 0.25)
        time.sleep(delay)

    raise GroqRateLimitExceeded(
        f"Groq rate limit exceeded after {max_retries} retries: {last_error}"
    ) from last_error
