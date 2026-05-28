"""User repository functions."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.models import User

if TYPE_CHECKING:
    from sqlalchemy.orm import Session


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def create_user(db: Session, *, email: str, username: str, hashed_password: str) -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=hashed_password,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user_preferences(db: Session, user: User, *, theme: str | None, language: str | None) -> User:
    if theme is not None:
        user.theme = theme
    if language is not None:
        user.language = language

    db.commit()
    db.refresh(user)
    return user


def update_user_password(db: Session, user: User, hashed_password: str) -> User:
    user.hashed_password = hashed_password
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()
