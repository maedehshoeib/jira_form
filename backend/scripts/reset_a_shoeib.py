import sqlite3
from pathlib import Path

from pwdlib import PasswordHash

hasher = PasswordHash.recommended()
DB = Path(__file__).resolve().parents[1] / "data" / "portal.db"
conn = sqlite3.connect(str(DB))
conn.execute(
    """
    UPDATE users
    SET password_hash = ?, is_active = 1, is_admin = 1, must_change_password = 0
    WHERE lower(username) = 'a.shoeib'
    """,
    (hasher.hash("Jethro@2003"),),
)
conn.commit()
print("a.shoeib rows", conn.total_changes)
conn.close()
