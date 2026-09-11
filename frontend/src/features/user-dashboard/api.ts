import client from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { fetchLegacyUserDashboard } from "./fallback";
import type { UserDashboardData } from "./types";

export type { DashboardChartItem, UserDashboardData } from "./types";

export async function fetchUserDashboard(): Promise<UserDashboardData> {
  try {
    const { data } = await client.get<unknown>(endpoints.userDashboard);
    if (
      data &&
      typeof data === "object" &&
      "summary" in data &&
      "task_statuses" in data &&
      Array.isArray((data as Partial<UserDashboardData>).task_statuses)
    ) {
      return data as UserDashboardData;
    }
  } catch {
    // Older running backends do not expose the aggregated endpoint yet.
  }
  return fetchLegacyUserDashboard();
}
