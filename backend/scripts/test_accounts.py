import json
import os
import urllib.request
from pathlib import Path

os.environ["NO_PROXY"] = "127.0.0.1,localhost"
os.environ["no_proxy"] = "127.0.0.1,localhost"
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

accounts = [
    ("Vosouq.admin", "Jethro@2003"),
    ("a.shoeib", "Jethro@2003"),
    ("ma.shoeib", "Secure@1234567"),
]
results = {}
for username, password in accounts:
    req = urllib.request.Request(
        "http://127.0.0.1:8000/api/v1/auth/login",
        data=json.dumps(
            {
                "username": username,
                "password": password,
                "device_id": "diag",
                "device_name": "diag",
            }
        ).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with opener.open(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            results[username] = {
                "status": resp.status,
                "user": body.get("user", {}).get("username"),
                "is_admin": body.get("user", {}).get("is_admin"),
            }
    except Exception as exc:  # noqa: BLE001
        detail = ""
        if hasattr(exc, "read"):
            try:
                detail = exc.read().decode("utf-8", "replace")
            except Exception:  # noqa: BLE001
                detail = ""
        results[username] = {"error": repr(exc), "detail": detail}

out = Path(__file__).resolve().parents[1] / "data" / "_login_accounts.json"
out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print("ok")
