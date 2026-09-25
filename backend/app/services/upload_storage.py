"""Safe path handling for locally stored lecture uploads."""

from collections.abc import Iterable
import logging
from pathlib import Path

from app.core.config import BACKEND_DIR, settings

logger = logging.getLogger(__name__)


def upload_root() -> Path:
    """Return the canonical configured upload directory."""
    root = Path(settings.UPLOAD_DIR)
    if not root.is_absolute():
        root = BACKEND_DIR / root
    return root.resolve()


def resolve_upload_path(stored_path: str | None) -> Path | None:
    """Resolve a persisted upload path only when it is below the upload root."""
    if not stored_path:
        return None

    path = Path(stored_path)
    candidate = (path if path.is_absolute() else BACKEND_DIR / path).resolve()
    root = upload_root()
    try:
        relative = candidate.relative_to(root)
    except ValueError:
        logger.warning("Refused lecture-file cleanup outside the configured upload directory.")
        return None

    # The upload root itself is a directory and must never be an unlink target.
    if relative == Path("."):
        logger.warning("Refused lecture-file cleanup for the upload directory itself.")
        return None
    return candidate


def collect_unshared_upload_paths(
    stored_paths: Iterable[str | None],
    surviving_stored_paths: Iterable[str | None],
) -> set[Path]:
    """Return unique, safe upload paths not referenced by surviving lectures."""
    candidates = {
        resolved
        for stored_path in set(stored_paths)
        if (resolved := resolve_upload_path(stored_path)) is not None
    }
    surviving = {
        resolved
        for stored_path in set(surviving_stored_paths)
        if (resolved := resolve_upload_path(stored_path)) is not None
    }
    return candidates - surviving


def remove_upload_file(path: Path) -> bool:
    """Best-effort removal after DB deletion; missing files count as success."""
    try:
        path.unlink(missing_ok=True)
        return True
    except OSError as exc:
        logger.warning("Lecture database record was deleted, but its upload could not be removed (%s).", type(exc).__name__)
        return False
