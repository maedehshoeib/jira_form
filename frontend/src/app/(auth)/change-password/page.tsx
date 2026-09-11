"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { ChangePasswordPage } from "@/features/auth";

export default function Page() {
  return <ProtectedFeature><ChangePasswordPage /></ProtectedFeature>;
}
