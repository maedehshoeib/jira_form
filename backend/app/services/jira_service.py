import httpx

from app.core.config import settings


class JiraService:
    BASE_PATH = "/rest/scriptrunner/latest/custom"

    async def _request(self, path: str, username: str = "", password: str = "") -> dict | list | None:
        if not settings.JIRA_ENABLED:
            return None

        url = f"{settings.JIRA_BASE_URL.rstrip('/')}{self.BASE_PATH}{path}"
        auth = None
        if username and password:
            auth = (username, password)
        elif settings.JIRA_USERNAME and settings.JIRA_PASSWORD:
            auth = (settings.JIRA_USERNAME, settings.JIRA_PASSWORD)

        try:
            async with httpx.AsyncClient(timeout=settings.JIRA_TIMEOUT, verify=False) as client:
                response = await client.get(url, auth=auth)
                if response.status_code == 200:
                    return response.json()
        except Exception:
            pass
        return None

    async def get_me(self, username: str = "", password: str = "") -> dict:
        data = await self._request("/me", username, password)
        if data:
            return data
        return {
            "username": username or "unknown",
            "displayName": username or "کاربر",
            "email": "",
        }

    async def get_users(self, username: str = "", password: str = "") -> list:
        data = await self._request("/users", username, password)
        if isinstance(data, list):
            return data
        return []

    async def get_request_types(self, username: str = "", password: str = "") -> list:
        data = await self._request("/requestTypes", username, password)
        if isinstance(data, list):
            return data
        return []


jira_service = JiraService()
