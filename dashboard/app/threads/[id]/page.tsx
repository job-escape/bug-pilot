import { getThread } from "@/lib/db";
import { redirect, notFound } from "next/navigation";

export default async function LegacyThreadRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const thread = await getThread(Number(id));
  if (!thread) notFound();
  redirect(`/repos/${encodeURIComponent(thread.repo)}/threads/${id}`);
}
