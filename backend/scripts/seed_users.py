from app.db.seed_users import seed_users
from app.db.session import SessionLocal


if __name__ == "__main__":
    db = SessionLocal()
    try:
        created, initialized = seed_users(db)
        print(f"Employee seed completed: {created} created, {initialized} initialized")
    finally:
        db.close()
