import { requireTreeAccess } from "@/lib/session";
import { GedcomUploader } from "@/components/import/gedcom-uploader";

export default async function ImportPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  await requireTreeAccess(treeId);
  return <GedcomUploader treeId={treeId} />;
}
