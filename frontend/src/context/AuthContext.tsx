import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import client from "../api/client";
import { endpoints } from "../api/endpoints";

export type AuthUser = {
  id: number;
  username: string;
  display_name: string;
  email: string;
  category: string;
  department: string;
  department_id: number | null;
  job_title: string;
  extension: string;
  avatar_url: string;
  birth_date?: string | null;
  is_birthday?: boolean;
  must_change_password: boolean;
  is_admin: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      void client
        .post(endpoints.logout, undefined, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => undefined);
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  const updateUser = useCallback((nextUser: AuthUser) => {
    localStorage.setItem("user", JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    let deviceId = localStorage.getItem("portal_device_id");
    if (!deviceId) {
      deviceId =
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("portal_device_id", deviceId);
    }
    const platform =
      (navigator as Navigator & { userAgentData?: { platform?: string } })
        .userAgentData?.platform || navigator.platform || "دستگاه";
    const browser = /Edg\//.test(navigator.userAgent)
      ? "Edge"
      : /Chrome\//.test(navigator.userAgent)
        ? "Chrome"
        : /Firefox\//.test(navigator.userAgent)
          ? "Firefox"
          : /Safari\//.test(navigator.userAgent)
            ? "Safari"
            : "مرورگر";
    const { data } = await client.post(endpoints.login, {
      username,
      password,
      device_id: deviceId,
      device_name: `${browser} - ${platform}`,
    });
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user as AuthUser;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }

    client
      .get(endpoints.me)
      .then((res) => {
        setUser(res.data);
        localStorage.setItem("user", JSON.stringify(res.data));
      })
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      updateUser,
      isAuthenticated: !!user,
    }),
    [user, loading, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
