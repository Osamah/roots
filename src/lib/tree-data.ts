import { prisma } from "@/lib/db";
import type { TreeGraph } from "@/lib/graph";

/** Loads the minimal graph (people + families + child links) for layout. */
export async function getTreeGraph(treeId: string): Promise<TreeGraph> {
  const [people, families, childLinks] = await Promise.all([
    prisma.person.findMany({
      where: { treeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        gender: true,
        birthDate: true,
        deathDate: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.family.findMany({
      where: { treeId },
      select: { id: true, partner1Id: true, partner2Id: true },
    }),
    prisma.childInFamily.findMany({
      where: { family: { treeId } },
      select: { familyId: true, childId: true },
    }),
  ]);

  return { people, families, childLinks };
}
