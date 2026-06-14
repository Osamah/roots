import Link from "next/link";
import { requireTreeAccess } from "@/lib/session";
import { TreeNav } from "@/components/tree/tree-nav";
import { TreeSearch } from "@/components/tree/tree-search";

export default async function TreeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  const { tree } = await requireTreeAccess(treeId);

  return (
    // Definite height (viewport − app header) so the 2D/3D views can fill it.
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/trees"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Trees
          </Link>
          <span className="font-semibold">{tree.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <TreeNav treeId={treeId} />
          <TreeSearch treeId={treeId} />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
