"use client";

import type { ReactNode } from "react";

import AdminRoute from "@/components/auth/AdminRoute";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

export default function ProtectedFeature({
  children,
  admin = false,
}: {
  children: ReactNode;
  admin?: boolean;
}) {
  const content = admin ? <AdminRoute>{children}</AdminRoute> : children;
  return <ProtectedRoute>{content}</ProtectedRoute>;
}
