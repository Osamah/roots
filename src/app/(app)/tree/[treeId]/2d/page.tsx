import { requireTreeAccess } from "@/lib/session";
import { getTreeGraph } from "@/lib/tree-data";
import { focusSubgraph } from "@/lib/graph";
import { TreeCanvas2D } from "@/components/tree2d/tree-canvas-2d";
import { EmptyTreeNotice } from "@/components/tree/empty-tree-notice";

export default async function Tree2DPage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ focus?: string; main?: string }>;
}) {
  const { treeId } = await params;
  const { focus, main } = await searchParams;
  await requireTreeAccess(treeId);

  const fullGraph = await getTreeGraph(treeId);
  if (fullGraph.people.length === 0) {
    return <EmptyTreeNotice treeId={treeId} />;
  }

  // If a main person is set (and exists), show only their ancestors + descendants
  // (and bloodline partners). Otherwise show the whole tree.
  const mainExists = main && fullGraph.people.some((p) => p.id === main);
  const graph = mainExists ? focusSubgraph(fullGraph, main) : fullGraph;

  const mainPerson = mainExists
    ? fullGraph.people.find((p) => p.id === main)
    : undefined;
  const mainName = mainPerson
    ? `${mainPerson.firstName} ${mainPerson.lastName}`.trim()
    : undefined;

  return (
    <TreeCanvas2D
      treeId={treeId}
      graph={graph}
      focusId={focus ?? (mainExists ? main : undefined)}
      mainId={mainExists ? main : undefined}
      mainName={mainName}
    />
  );
}
