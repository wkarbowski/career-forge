"""Refresh-token repository functions."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.models import RefreshToken

if TYPE_CHECKING:
    from datetime import datetime

    from sqlalchemy.orm import Session


def create_refresh_token_record(
    db: Session,
    *,
    token_hash: str,
    user_id: int,
    device_info: str | None,
    expires_at: datetime,
) -> RefreshToken:
    refresh_token = RefreshToken(
        token_hash=token_hash,
        user_id=user_id,
        device_info=device_info,
        expires_at=expires_at,
    )
    db.add(refresh_token)
    db.commit()
    return refresh_token


def get_refresh_token_by_hash(db: Session, token_hash: str) -> RefreshToken | None:
    return db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()


def mark_refresh_token_used(db: Session, refresh_token: RefreshToken, used_at: datetime) -> None:
    refresh_token.used_at = used_at
    db.commit()


def revoke_refresh_token_by_hash(db: Session, token_hash: str) -> int:
    result: int = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).update({"is_revoked": True})
    db.commit()
    return result


def revoke_user_refresh_tokens(db: Session, user_id: int, *, active_only: bool = False) -> int:
    query = db.query(RefreshToken).filter(RefreshToken.user_id == user_id)
    if active_only:
        query = query.filter(~RefreshToken.is_revoked)
    result: int = query.update({"is_revoked": True})
    db.commit()
    return result


def delete_expired_refresh_tokens(db: Session, before: datetime) -> int:
    result: int = db.query(RefreshToken).filter(RefreshToken.expires_at < before).delete()
    db.commit()
    return result
