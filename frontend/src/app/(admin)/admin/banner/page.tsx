"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { AdminBannerPage } from "@/features/admin";

export default function Page() {
  return <ProtectedFeature admin><AdminBannerPage /></ProtectedFeature>;
}
