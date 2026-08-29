"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { PdfFormsPage } from "@/features/documents";

export default function Page() {
  return <ProtectedFeature><PdfFormsPage /></ProtectedFeature>;
}
