"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { PortalCardPage } from "@/features/portal-cards";

export default function Page() {
  return <ProtectedFeature><PortalCardPage /></ProtectedFeature>;
}
