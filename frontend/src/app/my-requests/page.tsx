"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { MyRequestsPage } from "@/features/requests";

export default function Page() {
  return <ProtectedFeature><MyRequestsPage /></ProtectedFeature>;
}
