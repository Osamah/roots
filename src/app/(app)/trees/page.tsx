import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { CreateTreeDialog } from "./create-tree-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function TreesPage() {
  const user = await requireUser();

  const trees = await prisma.tree.findMany({
    where: {
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
    include: { _count: { select: { people: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Your trees</h1>
          <p className="text-sm text-muted-foreground">
            {trees.length} {trees.length === 1 ? "tree" : "trees"}
          </p>
        </div>
        <CreateTreeDialog />
      </div>

      {trees.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <span className="text-4xl">🌱</span>
            <p className="text-muted-foreground">
              No trees yet. Create one to get started.
            </p>
            <CreateTreeDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trees.map((tree) => (
            <Link key={tree.id} href={`/tree/${tree.id}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{tree.name}</span>
                    <Badge variant="secondary">{tree._count.people}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {tree.description || "No description"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
