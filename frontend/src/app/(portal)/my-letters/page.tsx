"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { MyLettersPage } from "@/features/letters";

export default function Page() {
  return (
    <ProtectedFeature>
      <MyLettersPage />
    </ProtectedFeature>
  );
}
