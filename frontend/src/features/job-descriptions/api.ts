import client from "@/api/client";
import { endpoints } from "@/api/endpoints";

import type { JobDescriptionDraft, JobDescriptionItem } from "./types";

export async function listJobDescriptions() {
  const { data } = await client.get<JobDescriptionItem[]>(endpoints.jobDescriptions);
  return data;
}

export async function createJobDescription(draft: JobDescriptionDraft) {
  const { data } = await client.post<JobDescriptionItem>(
    endpoints.adminJobDescriptions,
    toFormData(draft),
  );
  return data;
}

export async function updateJobDescription(id: number, draft: JobDescriptionDraft) {
  const { data } = await client.put<JobDescriptionItem>(
    `${endpoints.adminJobDescriptions}/${id}`,
    toFormData(draft),
  );
  return data;
}

export async function deleteJobDescription(id: number) {
  await client.delete(`${endpoints.adminJobDescriptions}/${id}`);
}

export async function downloadJobDescriptionAttachment(item: JobDescriptionItem) {
  const response = await client.get(
    `${endpoints.jobDescriptions}/${item.id}/attachment`,
    { responseType: "blob" },
  );
  const blob = new Blob([response.data]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = item.attachment_name || "attachment";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toFormData(draft: JobDescriptionDraft) {
  const form = new FormData();
  form.append("organizational_position", draft.organizational_position);
  form.append("organizational_unit", draft.organizational_unit);
  form.append("unit_responsibility", draft.unit_responsibility);
  form.append("qualification_requirements", draft.qualification_requirements);
  form.append("remove_photo", String(draft.remove_photo));
  form.append("remove_attachment", String(draft.remove_attachment));
  if (draft.photo) form.append("photo", draft.photo);
  if (draft.attachment) form.append("attachment", draft.attachment);
  return form;
}
