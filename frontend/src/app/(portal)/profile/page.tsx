"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { ProfilePage } from "@/features/profile";

export default function Page() {
  return <ProtectedFeature><ProfilePage /></ProtectedFeature>;
}
