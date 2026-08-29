from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

connect_args = {}
if settings.CONTRACTS_DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
contracts_engine = create_engine(
    settings.CONTRACTS_DATABASE_URL,
    connect_args=connect_args,
)
ContractsSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=contracts_engine,
)


def get_contracts_db():
    db = ContractsSessionLocal()
    try:
        yield db
    finally:
        db.close()
