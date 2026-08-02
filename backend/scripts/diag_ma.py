import json
import sqlite3
from pathlib import Path

from app.core.security import verify_password

db = Path(__file__).resolve().parents[1] / "data" / "portal.db"
con = sqlite3.connect(db)
cur = con.cursor()
rows = cur.execute(
    """
    select id, username, length(coalesce(password_hash,'')), is_active, is_admin
    from users
    where username in ('ma.shoeib','vosouq.admin','a.shoeib','admin')
       or username like '%shoeib%'
       or username like '%admin%'
    order by id
    """
).fetchall()
result = {"users": [list(r) for r in rows], "ma_checks": {}}
row = cur.execute(
    "select password_hash from users where username='ma.shoeib'"
).fetchone()
h = row[0] if row else ""
for pw in ["Secure@1234567", "Jethro@2003", "admin", "123456", "password"]:
    result["ma_checks"][pw] = bool(h) and verify_password(pw, h)
result["ma_hash_len"] = len(h or "")
con.close()
out = Path(__file__).resolve().parents[1] / "data" / "_diag_ma.json"
out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print("ok")
