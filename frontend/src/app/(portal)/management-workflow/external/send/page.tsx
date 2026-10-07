import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft } = await searchParams;
  const draftQuery = draft && /^\d+$/.test(draft) ? `&draft=${draft}` : "";
  redirect(`/my-letters?compose=external${draftQuery}`);
}
