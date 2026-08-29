"use client";

import dynamic from "next/dynamic";

const LegacyPortal = dynamic(() => import("@/app/legacy-portal"), {
  ssr: false,
});

export default function PortalPage() {
  return <LegacyPortal />;
}
