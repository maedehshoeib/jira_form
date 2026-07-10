from dataclasses import dataclass

from ldap3 import ALL, Connection, Server, Tls
from ldap3.core.exceptions import LDAPException

from app.core.config import settings


@dataclass
class LDAPUserInfo:
    username: str
    display_name: str
    email: str
    department: str = ""


class LDAPService:
    def authenticate(self, username: str, password: str) -> LDAPUserInfo | None:
        if not username or not password:
            return None

        if settings.LDAP_ENABLED:
            result = self._ldap_authenticate(username, password)
            if result:
                return result

        if settings.DEV_AUTH_ENABLED:
            return self._dev_authenticate(username, password)

        return None

    def _ldap_authenticate(self, username: str, password: str) -> LDAPUserInfo | None:
        try:
            tls = Tls() if settings.LDAP_USE_SSL else None
            server = Server(
                settings.LDAP_SERVER,
                port=settings.LDAP_PORT,
                use_ssl=settings.LDAP_USE_SSL,
                tls=tls,
                get_info=ALL,
            )

            user_dn = settings.LDAP_USER_DN_TEMPLATE.format(username=username)

            conn = Connection(server, user=user_dn, password=password, auto_bind=True)

            display_name = username
            email = ""
            department = ""

            search_filter = f"(sAMAccountName={username})"
            conn.search(
                settings.LDAP_BASE_DN,
                search_filter,
                attributes=["displayName", "mail", "department", "cn"],
            )

            if conn.entries:
                entry = conn.entries[0]
                display_name = str(getattr(entry, "displayName", username) or username)
                email = str(getattr(entry, "mail", "") or "")
                department = str(getattr(entry, "department", "") or "")

            conn.unbind()
            return LDAPUserInfo(
                username=username,
                display_name=display_name,
                email=email,
                department=department,
            )
        except LDAPException:
            return None
        except Exception:
            return None

    def _dev_authenticate(self, username: str, password: str) -> LDAPUserInfo | None:
        if username == settings.DEV_AUTH_USERNAME and password == settings.DEV_AUTH_PASSWORD:
            return LDAPUserInfo(
                username=username,
                display_name="کاربر تست",
                email=f"{username}@vosouq.local",
                department="فناوری اطلاعات",
            )
        return None


ldap_service = LDAPService()
