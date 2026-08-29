"use client";

import App from "@/App";
import { AppProviders } from "@/app/providers";

export default function LegacyPortal() {
  return (
    <AppProviders>
      <App />
    </AppProviders>
  );
}
