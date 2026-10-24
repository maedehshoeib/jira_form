"use client";

import { Suspense } from "react";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { AdminPortalCardsPage } from "@/features/portal-cards";

export default function Page() {
  return (
    <ProtectedFeature admin>
      <Suspense fallback={null}>
        <AdminPortalCardsPage />
      </Suspense>
    </ProtectedFeature>
  );
}
