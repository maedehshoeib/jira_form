import client from "@/api/client";
import { endpoints } from "@/api/endpoints";

export type LetterFolderScope = "received" | "sent";

export type LetterFolder = {
  id: number;
  name: string;
  scope: LetterFolderScope;
  sort_order: number;
  item_count: number;
  submission_ids: number[];
  batch_ids: string[];
};

export function customFolderKey(folderId: number) {
  return `custom:${folderId}` as const;
}

export function parseCustomFolderKey(folder: string): number | null {
  if (!folder.startsWith("custom:")) return null;
  const id = Number(folder.slice("custom:".length));
  return Number.isFinite(id) ? id : null;
}

export async function listLetterFolders(scope?: LetterFolderScope) {
  const { data } = await client.get<LetterFolder[]>(endpoints.managementLetterFolders, {
    params: scope ? { scope } : undefined,
  });
  return data;
}

export async function createLetterFolder(name: string, scope: LetterFolderScope) {
  const { data } = await client.post<LetterFolder>(endpoints.managementLetterFolders, {
    name,
    scope,
  });
  return data;
}

export async function renameLetterFolder(folderId: number, name: string) {
  const { data } = await client.patch<LetterFolder>(
    endpoints.managementLetterFolder(folderId),
    { name },
  );
  return data;
}

export async function deleteLetterFolder(folderId: number) {
  await client.delete(endpoints.managementLetterFolder(folderId));
}

export async function addLetterToFolder(
  folderId: number,
  payload: { submission_id?: number; batch_id?: string },
) {
  const { data } = await client.post(endpoints.managementLetterFolderItems(folderId), payload);
  return data;
}

export async function removeLetterFolderItem(folderId: number, itemId: number) {
  await client.delete(endpoints.managementLetterFolderItem(folderId, itemId));
}
