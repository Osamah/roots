import { redirect } from "next/navigation";

export default async function TreeIndex({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  redirect(`/tree/${treeId}/people`);
}
