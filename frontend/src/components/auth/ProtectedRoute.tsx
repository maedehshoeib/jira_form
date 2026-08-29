"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const redirectTo = !isAuthenticated
    ? "/login?from=" + encodeURIComponent(pathname)
    : user?.must_change_password && pathname !== "/change-password"
      ? "/change-password"
      : null;

  useEffect(() => {
    if (!loading && redirectTo) router.replace(redirectTo);
  }, [loading, redirectTo, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background font-sans">
        <p className="text-lg text-muted-foreground">در حال بارگذاری...</p>
      </div>
    );
  }

  if (redirectTo) return null;
  return <>{children}</>;
}
