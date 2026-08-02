"""Reset Vosouq.admin (and optionally other accounts) to known passwords."""
from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

# Prefer the same hashing library the app uses.
try:
    from pwdlib import PasswordHash

    hasher = PasswordHash.recommended()

    def hash_password(password: str) -> str:
        return hasher.hash(password)

except ImportError:
    try:
        from argon2 import PasswordHasher

        ph = PasswordHasher()

        def hash_password(password: str) -> str:
            return ph.hash(password)

    except ImportError:
        print("ERROR: install pwdlib or argon2-cffi first")
        sys.exit(1)

DB = Path(__file__).resolve().parents[1] / "data" / "portal.db"
ADMIN_USER = "vosouq.admin"
ADMIN_PASS = "Jethro@2003"
USER_PASS = "Secure@1234567"


def main() -> None:
    conn = sqlite3.connect(str(DB))
    # Normalize any invisible chars on admin username
    rows = conn.execute("SELECT id, username FROM users").fetchall()
    fixed_names = 0
    for user_id, username in rows:
        cleaned = username.strip().lower()
        # strip common Arabic combining marks that sneak in from RTL keyboards
        cleaned = "".join(ch for ch in cleaned if ord(ch) < 0x0300 or ord(ch) > 0x036F)
        cleaned = cleaned.replace("\u064e", "").replace("\u200c", "").replace("\u200f", "")
        cleaned = cleaned.replace("\u200e", "").replace("\ufeff", "")
        if cleaned != username:
            conn.execute("UPDATE users SET username = ? WHERE id = ?", (cleaned, user_id))
            fixed_names += 1

    admin = conn.execute(
        "SELECT id, username FROM users WHERE lower(username) = ?",
        (ADMIN_USER,),
    ).fetchone()
    if not admin:
        # create admin if missing
        conn.execute(
            """
            INSERT INTO users (
                username, password_hash, display_name, email, category, department,
                job_title, extension, avatar_url, is_active, is_admin, must_change_password
            ) VALUES (?, ?, ?, '', 'مدیریت', 'مدیریت', 'مدیر سامانه', '', '', 1, 1, 0)
            """,
            (ADMIN_USER, hash_password(ADMIN_PASS), "مدیر سامانه"),
        )
        print("created vosouq.admin")
    else:
        conn.execute(
            """
            UPDATE users
            SET password_hash = ?, is_active = 1, is_admin = 1, must_change_password = 0,
                username = ?
            WHERE id = ?
            """,
            (hash_password(ADMIN_PASS), ADMIN_USER, admin[0]),
        )
        print(f"reset vosouq.admin id={admin[0]}")

    # Also reset default seed password for ma.shoeib so a normal user can log in
    user = conn.execute(
        "SELECT id FROM users WHERE lower(username) = ?",
        ("ma.shoeib",),
    ).fetchone()
    if user:
        conn.execute(
            """
            UPDATE users
            SET password_hash = ?, is_active = 1, must_change_password = 0
            WHERE id = ?
            """,
            (hash_password(USER_PASS), user[0]),
        )
        print(f"reset ma.shoeib id={user[0]}")

    # Fix a.shoeib if present (exact username only)
    a_shoeib = conn.execute(
        "SELECT id FROM users WHERE lower(username) = 'a.shoeib'",
    ).fetchone()
    if a_shoeib:
        conn.execute(
            """
            UPDATE users
            SET password_hash = ?, is_active = 1,
                is_admin = 1, must_change_password = 0
            WHERE id = ?
            """,
            (hash_password(ADMIN_PASS), a_shoeib[0]),
        )
        print(f"reset a.shoeib id={a_shoeib[0]}")

    conn.commit()
    conn.close()
    print(f"fixed_names={fixed_names}")
    print(f"DB={DB}")
    print(f"Login: Vosouq.admin / {ADMIN_PASS}")
    print(f"Login: ma.shoeib / {USER_PASS}")


if __name__ == "__main__":
    main()
