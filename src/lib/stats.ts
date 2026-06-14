import { getTreeGraph } from "@/lib/tree-data";
import { layoutTree, type GraphPerson } from "@/lib/graph";

export interface TreeStats {
  totalPeople: number;
  generations: number;
  living: number;
  deceased: number;
  largestBranch: { name: string; size: number } | null;
  oldestAncestor: { name: string; year: number } | null;
  mostDescendants: { name: string; count: number } | null;
}

function year(date?: string | null): number | null {
  const m = (date ?? "").match(/\d{3,4}/);
  return m ? parseInt(m[0], 10) : null;
}

const name = (p: GraphPerson) => `${p.firstName} ${p.lastName}`.trim();

export async function computeTreeStats(treeId: string): Promise<TreeStats> {
  const graph = await getTreeGraph(treeId);
  const people = graph.people;
  const total = people.length;

  if (total === 0) {
    return {
      totalPeople: 0,
      generations: 0,
      living: 0,
      deceased: 0,
      largestBranch: null,
      oldestAncestor: null,
      mostDescendants: null,
    };
  }

  const layout = layoutTree(graph);
  const gens = [...layout.nodes.values()].map((n) => n.gen);
  const generations = gens.length ? Math.max(...gens) - Math.min(...gens) + 1 : 0;

  // Living = no death date recorded (best-effort).
  let deceased = 0;
  for (const p of people) if (p.deathDate) deceased++;
  const living = total - deceased;

  // Descendants via families + child links.
  const familyById = new Map(graph.families.map((f) => [f.id, f]));
  const childrenOf = new Map<string, string[]>();
  const parentsOf = new Map<string, string[]>();
  for (const link of graph.childLinks) {
    const fam = familyById.get(link.familyId);
    if (!fam) continue;
    for (const pid of [fam.partner1Id, fam.partner2Id]) {
      if (!pid) continue;
      childrenOf.set(pid, [...(childrenOf.get(pid) ?? []), link.childId]);
    }
    parentsOf.set(link.childId, [
      ...(parentsOf.get(link.childId) ?? []),
      ...[fam.partner1Id, fam.partner2Id].filter((p): p is string => !!p),
    ]);
  }

  const descendantCount = (id: string): number => {
    const seen = new Set<string>();
    const stack = [...(childrenOf.get(id) ?? [])];
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      stack.push(...(childrenOf.get(cur) ?? []));
    }
    return seen.size;
  };

  let mostDescendants: TreeStats["mostDescendants"] = null;
  let largestBranch: TreeStats["largestBranch"] = null;
  for (const p of people) {
    const count = descendantCount(p.id);
    if (!mostDescendants || count > mostDescendants.count) {
      mostDescendants = { name: name(p), count };
    }
    // Branch root = no parents; branch size includes the root itself.
    const isRoot = (parentsOf.get(p.id) ?? []).length === 0;
    if (isRoot) {
      const size = count + 1;
      if (!largestBranch || size > largestBranch.size) {
        largestBranch = { name: name(p), size };
      }
    }
  }

  // Oldest ancestor = earliest birth year.
  let oldestAncestor: TreeStats["oldestAncestor"] = null;
  for (const p of people) {
    const y = year(p.birthDate);
    if (y !== null && (!oldestAncestor || y < oldestAncestor.year)) {
      oldestAncestor = { name: name(p), year: y };
    }
  }

  return {
    totalPeople: total,
    generations,
    living,
    deceased,
    largestBranch,
    oldestAncestor,
    mostDescendants,
  };
}
