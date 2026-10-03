"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { JobDescriptionsPage } from "@/features/job-descriptions";

export default function Page() {
  return (
    <ProtectedFeature>
      <JobDescriptionsPage />
    </ProtectedFeature>
  );
}
