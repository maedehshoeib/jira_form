import client from "@/api/client";
import { endpoints } from "@/api/endpoints";

import type {
  CardFormSchema,
  CreateCardInput,
  PortalCardAdminDetail,
  PortalCardDetail,
  PortalCardSummary,
  UpdateCardInput,
} from "./types";

const adminBase = endpoints.adminPortalCards;

export async function listCards(parentId: number | null) {
  const { data } = await client.get<PortalCardSummary[]>(endpoints.portalCards, {
    params: parentId === null ? undefined : { parent_id: parentId },
  });
  return data;
}

export async function getCard(cardId: number) {
  const { data } = await client.get<PortalCardDetail>(`${endpoints.portalCards}/${cardId}`);
  return data;
}

export async function listAdminCards() {
  const { data } = await client.get<PortalCardSummary[]>(adminBase);
  return data;
}

export async function getAdminCard(cardId: number) {
  const { data } = await client.get<PortalCardAdminDetail>(`${adminBase}/${cardId}`);
  return data;
}

export async function createCard(input: CreateCardInput) {
  const form = new FormData();
  form.append("kind", input.kind);
  form.append("title", input.title);
  form.append("description", input.description);
  form.append("is_published", String(input.is_published));
  if (input.parent_id !== null) form.append("parent_id", String(input.parent_id));
  if (input.logo) form.append("logo", input.logo);
  const { data } = await client.post<PortalCardAdminDetail>(adminBase, form);
  return data;
}

export async function updateCard(cardId: number, input: UpdateCardInput) {
  const form = new FormData();
  form.append("title", input.title);
  form.append("description", input.description);
  form.append("is_published", String(input.is_published));
  form.append("remove_logo", String(input.remove_logo));
  if (input.logo) form.append("logo", input.logo);
  const { data } = await client.put<PortalCardAdminDetail>(`${adminBase}/${cardId}`, form);
  return data;
}

export async function deleteCard(cardId: number) {
  await client.delete(`${adminBase}/${cardId}`);
}

export async function moveCard(cardId: number, parentId: number | null) {
  const { data } = await client.post<PortalCardAdminDetail>(`${adminBase}/${cardId}/move`, {
    parent_id: parentId,
  });
  return data;
}

export async function reorderCards(parentId: number | null, orderedIds: number[]) {
  await client.post(`${adminBase}/reorder`, { parent_id: parentId, ordered_ids: orderedIds });
}

export async function saveCardForm(cardId: number, schema: CardFormSchema) {
  const { data } = await client.put<PortalCardAdminDetail>(`${adminBase}/${cardId}/form`, schema);
  return data;
}

export async function saveCardContent(cardId: number, content: string) {
  const { data } = await client.put<PortalCardAdminDetail>(`${adminBase}/${cardId}/content`, {
    content,
  });
  return data;
}

export async function uploadCardFile(cardId: number, title: string, file: File) {
  const form = new FormData();
  form.append("title", title);
  form.append("file", file);
  const { data } = await client.post<PortalCardAdminDetail>(
    `${adminBase}/${cardId}/files`,
    form,
  );
  return data;
}

export async function removeCardFile(cardId: number, fileId: number) {
  const { data } = await client.delete<PortalCardAdminDetail>(
    `${adminBase}/${cardId}/files/${fileId}`,
  );
  return data;
}

export async function fetchCardFile(cardId: number, fileId: number) {
  const { data } = await client.get<Blob>(
    `${endpoints.portalCards}/${cardId}/files/${fileId}`,
    { responseType: "blob" },
  );
  return data;
}

export function requestErrorMessage(error: unknown, fallback: string) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data
    ?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: string };
    if (typeof first?.msg === "string") return first.msg.replace(/^Value error, /, "");
  }
  return fallback;
}
