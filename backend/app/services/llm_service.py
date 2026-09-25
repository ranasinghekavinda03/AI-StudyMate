"""Small provider-neutral interface for text answer generation."""

from collections.abc import Callable
from functools import lru_cache
import logging
import random
import time
from typing import TypeVar

from app.core.config import settings

logger = logging.getLogger(__name__)
MAX_PROVIDER_ATTEMPTS = 3
RETRYABLE_STATUSES = frozenset({408, 429, 500, 502, 503, 504})
_T = TypeVar("_T")
_sleep = time.sleep


def _jitter() -> float:
    return random.uniform(0.0, 0.25)


class LLMError(RuntimeError):
    """Base exception for safe LLM failures."""


class LLMConfigurationError(LLMError):
    """Raised when the selected provider is not configured."""


class LLMProviderError(LLMError):
    """Raised when a configured provider fails or returns no answer."""


class _EmptyProviderResponse(RuntimeError):
    """Internal retry signal for a successful response without usable text."""


def _provider_status(exc: Exception) -> int | None:
    """Extract a provider HTTP status without retaining or logging details."""
    for value in (
        getattr(exc, "code", None),
        getattr(exc, "status_code", None),
        getattr(exc, "status", None),
        getattr(getattr(exc, "response", None), "status_code", None),
    ):
        if value is None:
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            continue
    return None


def _error_category(exc: Exception) -> str:
    if isinstance(exc, _EmptyProviderResponse):
        return "empty-response"
    status = _provider_status(exc)
    if status is not None:
        return str(status)
    if "timeout" in type(exc).__name__.lower():
        return "timeout"
    return type(exc).__name__


def _is_transient_failure(exc: Exception) -> bool:
    if isinstance(exc, _EmptyProviderResponse):
        return True
    status = _provider_status(exc)
    if status in RETRYABLE_STATUSES:
        return True
    # Transport timeouts may not carry an HTTP response/status.
    return "timeout" in type(exc).__name__.lower()


def _with_gemini_retries(operation: Callable[[], _T], *, failure_message: str) -> _T:
    """Run one Gemini operation with a bounded transient-failure retry policy."""
    for attempt in range(1, MAX_PROVIDER_ATTEMPTS + 1):
        try:
            return operation()
        except LLMError:
            raise
        except Exception as exc:
            category = _error_category(exc)
            if _is_transient_failure(exc) and attempt < MAX_PROVIDER_ATTEMPTS:
                logger.warning(
                    "Gemini transient failure %s on attempt %d/%d; retrying.",
                    category,
                    attempt,
                    MAX_PROVIDER_ATTEMPTS,
                )
                _sleep((2 ** (attempt - 1)) + _jitter())
                continue
            logger.error(
                "Gemini generation failed after attempt %d/%d (%s).",
                attempt,
                MAX_PROVIDER_ATTEMPTS,
                category,
            )
            raise LLMProviderError(failure_message) from exc
    raise AssertionError("Gemini retry loop exited unexpectedly.")


@lru_cache(maxsize=1)
def _get_gemini_client():
    if not settings.LLM_API_KEY.strip():
        raise LLMConfigurationError("The language model provider is not configured.")
    try:
        from google import genai
        from google.genai import types

        return genai.Client(
            api_key=settings.LLM_API_KEY,
            http_options=types.HttpOptions(
                timeout=settings.LLM_TIMEOUT_SECONDS * 1000,
                # Application retries below also cover empty provider responses.
                # Keep SDK attempts at one so the total budget remains exactly three.
                retry_options=types.HttpRetryOptions(attempts=1),
            ),
        )
    except LLMConfigurationError:
        raise
    except Exception as exc:
        logger.error("Gemini client initialization failed (%s).", type(exc).__name__)
        raise LLMProviderError("The language model provider is unavailable.") from exc


def _generate_with_gemini(*, system_instruction: str, prompt: str) -> str:
    try:
        from google.genai import types
    except LLMError:
        raise
    except Exception as exc:
        logger.error("Gemini request configuration failed (%s).", type(exc).__name__)
        raise LLMProviderError("The language model provider could not generate an answer.") from exc

    client = _get_gemini_client()

    def generate() -> str:
        response = client.models.generate_content(
            model=settings.LLM_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1,
                max_output_tokens=1024,
            ),
        )
        answer = (getattr(response, "text", None) or "").strip()
        if not answer:
            raise _EmptyProviderResponse()
        return answer

    return _with_gemini_retries(
        generate,
        failure_message="The language model provider could not generate an answer.",
    )


def generate_answer(*, system_instruction: str, prompt: str) -> str:
    """Generate an answer through the configured provider."""
    provider = settings.LLM_PROVIDER.strip().lower()
    if provider == "gemini":
        return _generate_with_gemini(system_instruction=system_instruction, prompt=prompt)
    raise LLMConfigurationError("The configured language model provider is unsupported.")


def generate_structured_answer(*, system_instruction: str, prompt: str, response_schema) -> str:
    """Generate provider-validated JSON for a supplied Pydantic response schema."""
    if settings.LLM_PROVIDER.strip().lower() != "gemini":
        raise LLMConfigurationError("The configured language model provider is unsupported.")
    try:
        from google.genai import types
    except LLMError:
        raise
    except Exception as exc:
        logger.error("Gemini structured request configuration failed (%s).", type(exc).__name__)
        raise LLMProviderError("The language model provider could not generate structured output.") from exc

    client = _get_gemini_client()

    def generate() -> str:
        response = client.models.generate_content(
            model=settings.LLM_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.2,
                max_output_tokens=4096,
                response_mime_type="application/json",
                response_schema=response_schema,
            ),
        )
        output = (getattr(response, "text", None) or "").strip()
        if not output:
            raise _EmptyProviderResponse()
        return output

    return _with_gemini_retries(
        generate,
        failure_message="The language model provider could not generate structured output.",
    )
