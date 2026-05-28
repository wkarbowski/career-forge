"""Profile-image storage helpers."""

from __future__ import annotations

import contextlib
import os
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from fastapi import HTTPException

if TYPE_CHECKING:
    from fastapi import UploadFile

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024


def ensure_upload_dir(upload_dir: str) -> None:
    os.makedirs(upload_dir, exist_ok=True)


def remove_profile_image_file(upload_dir: str, filename: str | None) -> None:
    if not filename:
        return

    file_path = os.path.join(upload_dir, filename)
    if os.path.isfile(file_path):
        with contextlib.suppress(OSError):
            os.remove(file_path)


async def store_profile_image(
    *,
    document_id: int,
    file: UploadFile,
    upload_dir: str,
    old_filename: str | None,
) -> str:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    ext = os.path.splitext(file.filename)[-1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, GIF, and WebP images are allowed")

    content = await file.read(MAX_IMAGE_SIZE_BYTES + 1)
    if len(content) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be 5 MB or smaller")

    ensure_upload_dir(upload_dir)
    filename = f"doc_{document_id}_{int(datetime.now(UTC).timestamp())}{ext}"
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, "wb") as f:
        f.write(content)

    remove_profile_image_file(upload_dir, old_filename)
    return filename
