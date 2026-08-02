import json
import sqlite3
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "data" / "portal.db"
conn = sqlite3.connect(str(DB))
cols = [r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()]
rows = conn.execute(
    "SELECT id, username, is_active, length(COALESCE(password_hash,'')) "
    "FROM users ORDER BY id"
).fetchall()
admins = []
if "is_admin" in cols:
    admins = conn.execute(
        "SELECT id, username, is_admin, is_active, "
        "substr(COALESCE(password_hash,''),1,30) "
        "FROM users WHERE is_admin=1 OR lower(username) LIKE '%admin%' "
        "OR lower(username) LIKE '%shoeib%' ORDER BY id"
    ).fetchall()
out = {
    "db": str(DB),
    "cols": cols,
    "user_count": len(rows),
    "sample_usernames": [repr(r[1]) for r in rows[:15]],
    "admins": [
        {
            "id": a[0],
            "username": a[1],
            "username_repr": repr(a[1]),
            "is_admin": a[2],
            "is_active": a[3],
            "pw_prefix": a[4],
        }
        for a in admins
    ],
}
Path(__file__).resolve().parents[1].joinpath("data", "_db_diag.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print("ok")
conn.close()
