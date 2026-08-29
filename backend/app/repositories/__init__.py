"""Persistence-only modules used by domain services."""

from app.repositories.submissions import SubmissionRepository
from app.repositories.users import UserRepository

__all__ = ["SubmissionRepository", "UserRepository"]
