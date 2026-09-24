"""Small provider-neutral interface for text answer generation."""

from functools import lru_cache
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class LLMError(RuntimeError):
    """Base exception for safe LLM failures."""


class LLMConfigurationError(LLMError):
    """Raised when the selected provider is not configured."""


class LLMProviderError(LLMError):
    """Raised when a configured provider fails or returns no answer."""


@lru_cache(maxsize=1)
def _get_gemini_client():
    if not settings.LLM_API_KEY.strip():
        raise LLMConfigurationError("The language model provider is not configured.")
    try:
        from google import genai
        from google.genai import types

        return genai.Client(
            api_key=settings.LLM_API_KEY,
            http_options=types.HttpOptions(timeout=settings.LLM_TIMEOUT_SECONDS * 1000),
        )
    except LLMConfigurationError:
        raise
    except Exception as exc:
        logger.error("Gemini client initialization failed (%s).", type(exc).__name__)
        raise LLMProviderError("The language model provider is unavailable.") from exc


def _generate_with_gemini(*, system_instruction: str, prompt: str) -> str:
    try:
        from google.genai import types

        response = _get_gemini_client().models.generate_content(
            model=settings.LLM_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.1,
                max_output_tokens=1024,
            ),
        )
        answer = (response.text or "").strip()
    except LLMError:
        raise
    except Exception as exc:
        # Do not include exception text: provider errors can contain request details.
        logger.error("Gemini generation failed (%s).", type(exc).__name__)
        raise LLMProviderError("The language model provider could not generate an answer.") from exc
    if not answer:
        raise LLMProviderError("The language model provider returned an empty response.")
    return answer


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

        response = _get_gemini_client().models.generate_content(
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
        output = (response.text or "").strip()
    except LLMError:
        raise
    except Exception as exc:
        logger.error("Gemini structured generation failed (%s).", type(exc).__name__)
        raise LLMProviderError("The language model provider could not generate structured output.") from exc
    if not output:
        raise LLMProviderError("The language model provider returned an empty response.")
    return output
