"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { PdfLibraryPage } from "@/features/documents";

export default function Page() {
  return <ProtectedFeature><PdfLibraryPage category="documents" /></ProtectedFeature>;
}
