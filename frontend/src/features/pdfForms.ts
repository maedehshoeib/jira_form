import client from "../api/client";
import { endpoints } from "../api/endpoints";

export type PdfFormItem = {
  id: number;
  title: string;
  description: string;
  file_name: string;
  file_size: number;
  created_at: string;
};

export async function getPdfBlob(formId: number) {
  const { data } = await client.get<Blob>(
    `${endpoints.pdfForms}/${formId}/file`,
    { responseType: "blob" },
  );
  return data;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
