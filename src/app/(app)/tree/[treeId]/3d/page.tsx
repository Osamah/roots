import { requireTreeAccess } from "@/lib/session";
import { getTreeGraph } from "@/lib/tree-data";
import { buildLayout3D } from "@/lib/layout3d";
import { Roots3DLoader } from "@/components/tree3d/roots-3d-loader";
import { EmptyTreeNotice } from "@/components/tree/empty-tree-notice";

export default async function Tree3DPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { treeId } = await params;
  const { focus } = await searchParams;
  await requireTreeAccess(treeId);

  const graph = await getTreeGraph(treeId);
  if (graph.people.length === 0) {
    return <EmptyTreeNotice treeId={treeId} />;
  }

  const data = buildLayout3D(graph);
  return <Roots3DLoader treeId={treeId} data={data} focusId={focus} />;
}
