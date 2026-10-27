import client from "../../api/client";
import { endpoints } from "../../api/endpoints";

export type FormDutyCatalogTarget = {
  portal_department_id: string;
  portal_department_title: string;
  section_id: string;
  section_title: string;
  form_id: string;
  kind?: string;
  is_published?: boolean;
};

export type FormDutyEdge = {
  user_id: number;
  username: string;
  display_name: string;
  target_key: string;
  portal_department_id: string;
  portal_department_title: string;
  section_id: string;
  section_title: string;
  form_id: string;
};

export type FormDutyResponse = {
  assignments: FormDutyEdge[];
};

export type DutyEdgeInput = {
  user_id: number;
  target_key: string;
};

export const formTargetKey = (target: FormDutyCatalogTarget) =>
  `${target.portal_department_id}:${target.section_id}:${target.form_id}`;

export function formDutyLabel(target: FormDutyCatalogTarget) {
  const kind =
    target.kind === "group" ? "کارت گروهی" : target.kind === "form" ? "فرم" : "";
  const draft = target.is_published === false ? "پیش‌نویس" : "";
  const label = [kind, target.section_title].filter(Boolean).join(" · ");
  return draft ? `${label} — ${draft}` : label;
}

export const edgeKey = (userId: number, targetKey: string) =>
  `${userId}::${targetKey}`;

export async function fetchFormDutyCatalog() {
  const { data } = await client.get<FormDutyCatalogTarget[]>(
    endpoints.adminFormAccessCatalog,
  );
  return data.filter(
    (target) =>
      Boolean(target.section_id) &&
      target.kind !== "document" &&
      !target.form_id.startsWith("document-"),
  );
}

export async function fetchFormDuties() {
  const { data } = await client.get<FormDutyResponse>(endpoints.adminFormDuties);
  return data;
}

export async function saveFormDuties(assignments: DutyEdgeInput[]) {
  const { data } = await client.put<FormDutyResponse>(endpoints.adminFormDuties, {
    assignments,
  });
  return data;
}

export function dutyRequestError(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null && "response" in error) {
    const detail = (error as { response?: { data?: { detail?: unknown } } }).response
      ?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}
