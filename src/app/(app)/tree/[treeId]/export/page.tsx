import { requireTreeAccess } from "@/lib/session";
import { GedcomExporter } from "@/components/export/gedcom-exporter";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  await requireTreeAccess(treeId);
  return <GedcomExporter treeId={treeId} />;
}
