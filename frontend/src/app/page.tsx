"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { HomePage } from "@/features/home";

export default function Page() {
  return <ProtectedFeature><HomePage /></ProtectedFeature>;
}
