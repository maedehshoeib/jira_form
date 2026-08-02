import json
import os
import urllib.request
from pathlib import Path

# Bypass any corporate/system HTTP proxy for local API checks.
os.environ["NO_PROXY"] = "127.0.0.1,localhost"
os.environ["no_proxy"] = "127.0.0.1,localhost"
proxy_handler = urllib.request.ProxyHandler({})
opener = urllib.request.build_opener(proxy_handler)

out = Path(__file__).resolve().parents[1] / "data" / "_login_test.json"
results = {}
for label, req in [
    (
        "docs",
        urllib.request.Request("http://127.0.0.1:8000/docs", method="GET"),
    ),
    (
        "login",
        urllib.request.Request(
            "http://127.0.0.1:8000/api/v1/auth/login",
            data=json.dumps(
                {
                    "username": "Vosouq.admin",
                    "password": "Jethro@2003",
                    "device_id": "diag",
                    "device_name": "diag",
                }
            ).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        ),
    ),
]:
    try:
        with opener.open(req, timeout=15) as resp:
            body = resp.read()[:300].decode("utf-8", "replace")
            results[label] = {"status": resp.status, "body": body}
    except Exception as exc:  # noqa: BLE001
        body = ""
        if hasattr(exc, "read"):
            try:
                body = exc.read()[:300].decode("utf-8", "replace")
            except Exception:  # noqa: BLE001
                body = ""
        results[label] = {"error": repr(exc), "body": body}
out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print("ok")
