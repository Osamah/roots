import { prisma } from "@/lib/db";

export interface SearchHit {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  occupation: string | null;
}

/** Search people in a tree by name, place, occupation, notes, or biography. */
export async function searchPeopleInTree(
  treeId: string,
  query: string,
  limit = 20,
): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const contains = { contains: q, mode: "insensitive" as const };
  return prisma.person.findMany({
    where: {
      treeId,
      OR: [
        { firstName: contains },
        { lastName: contains },
        { middleNames: contains },
        { nickname: contains },
        { birthPlace: contains },
        { deathPlace: contains },
        { occupation: contains },
        { notes: contains },
        { biography: contains },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      deathDate: true,
      birthPlace: true,
      occupation: true,
    },
    take: limit,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}
