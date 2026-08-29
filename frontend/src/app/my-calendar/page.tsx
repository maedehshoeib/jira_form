"use client";

import ProtectedFeature from "@/app/_components/ProtectedFeature";
import { MyCalendarPage } from "@/features/calendar";

export default function Page() {
  return <ProtectedFeature><MyCalendarPage /></ProtectedFeature>;
}
