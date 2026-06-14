import { layoutTree, type TreeGraph } from "@/lib/graph";

export interface Node3D {
  id: string;
  x: number;
  y: number;
  z: number;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate: string | null;
  deathDate: string | null;
}

export interface Layout3DData {
  nodes: Node3D[];
  partnerEdges: { aId: string; bId: string }[];
  parentEdges: { childId: string; parentIds: string[] }[];
}

// Spatial scale: Y = generations (layers), X = sibling spread, Z = branch sep.
const SX = 6;
const SY = 7;
const SZ = 9;

/**
 * 3D layout: generations form horizontal layers on Y (top = oldest), siblings
 * spread on X (reusing the shared layered layout), and distinct family branches
 * are separated along Z so the tree reads as a navigable volume.
 */
export function buildLayout3D(graph: TreeGraph): Layout3DData {
  const res = layoutTree(graph);

  // parentsOf, to find each node's originating branch (top ancestor).
  const familyById = new Map(graph.families.map((f) => [f.id, f]));
  const parentsOf = new Map<string, string[]>();
  for (const link of graph.childLinks) {
    const fam = familyById.get(link.familyId);
    if (!fam) continue;
    const ps = [fam.partner1Id, fam.partner2Id].filter(
      (p): p is string => !!p,
    );
    parentsOf.set(link.childId, [...(parentsOf.get(link.childId) ?? []), ...ps]);
  }

  const branchMemo = new Map<string, string>();
  const branchRoot = (id: string, guard = new Set<string>()): string => {
    const cached = branchMemo.get(id);
    if (cached) return cached;
    if (guard.has(id)) return id;
    guard.add(id);
    const parents = parentsOf.get(id) ?? [];
    const root = parents.length ? branchRoot(parents[0], guard) : id;
    branchMemo.set(id, root);
    return root;
  };

  // Order branches by their root's X so the Z spread stays visually coherent.
  const rootIds = [...new Set([...res.nodes.keys()].map((id) => branchRoot(id)))];
  rootIds.sort(
    (a, b) => (res.nodes.get(a)?.x ?? 0) - (res.nodes.get(b)?.x ?? 0),
  );
  const branchIndex = new Map(rootIds.map((id, i) => [id, i]));
  const mid = (rootIds.length - 1) / 2;

  const nodes: Node3D[] = [...res.nodes.values()].map((n) => {
    const bIdx = branchIndex.get(branchRoot(n.id)) ?? 0;
    return {
      id: n.id,
      x: n.x * SX,
      y: -n.gen * SY,
      z: (bIdx - mid) * SZ,
      firstName: n.person.firstName,
      lastName: n.person.lastName,
      gender: n.person.gender,
      birthDate: n.person.birthDate ?? null,
      deathDate: n.person.deathDate ?? null,
    };
  });

  return {
    nodes,
    partnerEdges: res.partnerEdges.map((e) => ({ aId: e.aId, bId: e.bId })),
    parentEdges: res.parentEdges.map((e) => ({
      childId: e.childId,
      parentIds: e.parentIds,
    })),
  };
}
