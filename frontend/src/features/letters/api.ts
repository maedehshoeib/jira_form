import client from "@/api/client";
import { endpoints } from "@/api/endpoints";

export async function setLetterArchived(submissionId: number, archived: boolean) {
  const { data } = await client.patch<{ submission_id: number; is_archived: boolean }>(
    endpoints.taskArchive(submissionId),
    { archived },
  );
  return data;
}
