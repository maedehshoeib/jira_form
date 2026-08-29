"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user?.is_admin) router.replace("/");
  }, [router, user?.is_admin]);

  if (!user?.is_admin) return null;
  return <>{children}</>;
}
