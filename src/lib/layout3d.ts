import { layoutTree, serializeLayout, type TreeGraph } from "@/lib/graph";

// 3D mirrors the 2D tree (generations as layers, families packed side by side)
// but every person appears exactly once. Cross-lineage marriages — the ones 2D
// renders as duplicates — are drawn here as real links arcing through depth.

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

export interface Edge3D {
  id: string;
  aId: string;
  bId: string;
}

export interface Layout3DData {
  nodes: Node3D[];
  parentEdges: Edge3D[]; // anchor parent -> child
  partnerEdges: Edge3D[]; // adjacent couples (short)
  crossEdges: Edge3D[]; // cross-lineage marriages (long, arced)
}

const SX = 7; // sibling spacing
const SY = 9; // generation spacing
// A couple placed adjacently sits ~1 layout unit apart; anything well beyond
// that joins two different lineages and is drawn as an arced cross link.
const CROSS_THRESHOLD = 2.5 * SX;

export function buildLayout3D(graph: TreeGraph): Layout3DData {
  const flat = serializeLayout(layoutTree(graph, { duplicateSpouses: false }));

  const nodes: Node3D[] = flat.nodes.map((n) => ({
    id: n.id,
    x: n.x * SX,
    y: -n.gen * SY,
    z: 0,
    firstName: n.firstName,
    lastName: n.lastName,
    gender: n.gender,
    birthDate: n.birthDate,
    deathDate: n.deathDate,
  }));
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Parent connector: from the parent the child is laid out under, to the child.
  const parentEdges: Edge3D[] = [];
  for (const e of flat.parentEdges) {
    const parent = e.anchorId ?? e.parentIds[0];
    if (parent && byId.has(parent) && byId.has(e.childId)) {
      parentEdges.push({ id: e.id, aId: parent, bId: e.childId });
    }
  }

  const partnerEdges: Edge3D[] = [];
  const crossEdges: Edge3D[] = [];
  for (const e of flat.partnerEdges) {
    const a = byId.get(e.aId);
    const b = byId.get(e.bId);
    if (!a || !b) continue;
    const far = Math.hypot(a.x - b.x, a.y - b.y) > CROSS_THRESHOLD;
    (far ? crossEdges : partnerEdges).push({ id: e.id, aId: e.aId, bId: e.bId });
  }

  return { nodes, parentEdges, partnerEdges, crossEdges };
}
