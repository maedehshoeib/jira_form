"""Shared base for OOP domain service classes."""

from sqlalchemy.orm import Session


class BaseService:
    def __init__(self, db: Session) -> None:
        self.db = db
