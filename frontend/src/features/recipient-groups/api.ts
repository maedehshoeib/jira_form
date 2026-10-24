import client from "@/api/client";
import { endpoints } from "@/api/endpoints";

import type { RecipientGroup, RecipientGroupInput } from "./types";

function groupErrorMessage(err: unknown, fallback: string): string {
  if (!err || typeof err !== "object" || !("response" in err)) return fallback;
  const detail = (err as { response?: { data?: { detail?: unknown } } }).response
    ?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  return fallback;
}

export async function listRecipientGroups(): Promise<RecipientGroup[]> {
  const { data } = await client.get<RecipientGroup[]>(endpoints.recipientGroups);
  return data;
}

export async function createRecipientGroup(
  input: RecipientGroupInput,
): Promise<RecipientGroup> {
  const { data } = await client.post<RecipientGroup>(endpoints.recipientGroups, input);
  return data;
}

export async function updateRecipientGroup(
  groupId: number,
  input: RecipientGroupInput,
): Promise<RecipientGroup> {
  const { data } = await client.put<RecipientGroup>(
    endpoints.recipientGroup(groupId),
    input,
  );
  return data;
}

export async function deleteRecipientGroup(groupId: number): Promise<void> {
  await client.delete(endpoints.recipientGroup(groupId));
}

export { groupErrorMessage };
