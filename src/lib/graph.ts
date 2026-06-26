// Shared genealogy graph + layout engine. Pure functions — consumed by both the
// 2D editor and the 3D Roots view. The DB shape is reduced to a minimal graph,
// generations are assigned by ancestry, and a layered layout produces positions.

export interface GraphPerson {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  birthDate?: string | null;
  deathDate?: string | null;
}

export interface GraphFamily {
  id: string;
  partner1Id?: string | null;
  partner2Id?: string | null;
}

export interface GraphChildLink {
  familyId: string;
  childId: string;
}

export interface TreeGraph {
  people: GraphPerson[];
  families: GraphFamily[];
  childLinks: GraphChildLink[];
}

/**
 * Restrict the graph to a "main" person's direct ancestors and all descendants,
 * plus the partners of that bloodline (so couples render) — but NOT the
 * ancestors of those partners. Returns a new filtered TreeGraph.
 */
export function focusSubgraph(graph: TreeGraph, mainId: string): TreeGraph {
  const familyById = new Map(graph.families.map((f) => [f.id, f]));

  // parentsOf (from a child's families) and childrenOf / partnersOf (from a
  // person's families as a partner).
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const partnersOf = new Map<string, string[]>();
  for (const link of graph.childLinks) {
    const fam = familyById.get(link.familyId);
    if (!fam) continue;
    const ps = [fam.partner1Id, fam.partner2Id].filter((p): p is string => !!p);
    parentsOf.set(link.childId, [...(parentsOf.get(link.childId) ?? []), ...ps]);
    for (const p of ps) {
      childrenOf.set(p, [...(childrenOf.get(p) ?? []), link.childId]);
    }
  }
  for (const fam of graph.families) {
    if (fam.partner1Id && fam.partner2Id) {
      partnersOf.set(fam.partner1Id, [
        ...(partnersOf.get(fam.partner1Id) ?? []),
        fam.partner2Id,
      ]);
      partnersOf.set(fam.partner2Id, [
        ...(partnersOf.get(fam.partner2Id) ?? []),
        fam.partner1Id,
      ]);
    }
  }

  const climb = (start: string, next: Map<string, string[]>): Set<string> => {
    const out = new Set<string>();
    const stack = [...(next.get(start) ?? [])];
    while (stack.length) {
      const cur = stack.pop()!;
      if (out.has(cur)) continue;
      out.add(cur);
      stack.push(...(next.get(cur) ?? []));
    }
    return out;
  };

  const ancestors = climb(mainId, parentsOf);
  const descendants = climb(mainId, childrenOf);
  const blood = new Set<string>([mainId, ...ancestors, ...descendants]);

  // Partners of the going-down bloodline (main + descendants) so couples show.
  // Deliberately excludes partners of ancestors and any partner's own ancestors.
  const visible = new Set<string>(blood);
  for (const id of [mainId, ...descendants]) {
    for (const p of partnersOf.get(id) ?? []) visible.add(p);
  }

  // A family is in scope if it links the bloodline: a blood partner (descent
  // family) or a blood child (ancestral family).
  const families = graph.families.filter((f) => {
    const partnerBlood =
      (f.partner1Id && blood.has(f.partner1Id)) ||
      (f.partner2Id && blood.has(f.partner2Id));
    const childBlood = graph.childLinks.some(
      (l) => l.familyId === f.id && blood.has(l.childId),
    );
    return partnerBlood || childBlood;
  });
  const familyIds = new Set(families.map((f) => f.id));

  // Keep only child links whose child is visible (drops aunts/uncles and the
  // partners' children from other unions).
  const childLinks = graph.childLinks.filter(
    (l) => familyIds.has(l.familyId) && visible.has(l.childId),
  );

  const people = graph.people.filter((p) => visible.has(p.id));
  return { people, families, childLinks };
}

export interface LaidOutNode {
  id: string; // layout id (a duplicate spouse has a synthetic id)
  refId: string; // the real Person id this node represents
  isDuplicate: boolean; // true for a spouse shown beside a partner + in their own family
  person: GraphPerson;
  x: number;
  gen: number;
}

export interface PartnerEdge {
  id: string;
  aId: string;
  bId: string;
}

export interface ParentEdge {
  id: string;
  familyId: string;
  childId: string;
  parentIds: string[];
  // The partner the child is laid out under — connectors attach here so a
  // far-away (cross-marriage) co-parent doesn't drag a long line across.
  anchorId?: string;
}

export interface LayoutResult {
  nodes: Map<string, LaidOutNode>;
  partnerEdges: PartnerEdge[];
  parentEdges: ParentEdge[];
  generations: number; // count of distinct generation rows
  bounds: { minX: number; maxX: number; minGen: number; maxGen: number };
}

/** parentIds for each child, derived from families + child links. */
function buildParentIndex(graph: TreeGraph) {
  const familyById = new Map(graph.families.map((f) => [f.id, f]));
  const parentsOf = new Map<string, string[]>();
  const childrenOfFamily = new Map<string, string[]>();

  for (const link of graph.childLinks) {
    const fam = familyById.get(link.familyId);
    if (!fam) continue;
    const parents = [fam.partner1Id, fam.partner2Id].filter(
      (p): p is string => !!p,
    );
    parentsOf.set(link.childId, [
      ...(parentsOf.get(link.childId) ?? []),
      ...parents,
    ]);
    childrenOfFamily.set(link.familyId, [
      ...(childrenOfFamily.get(link.familyId) ?? []),
      link.childId,
    ]);
  }
  return { familyById, parentsOf, childrenOfFamily };
}

/**
 * Generation per node via constraint propagation: every child sits exactly one
 * row below its parents, and partners share a row. This anchors each ancestral
 * line relative to where it joins the tree rather than pinning every root to the
 * top — so a 3-generation branch hangs lower than a 20-generation branch instead
 * of both topping out on row 0.
 */
function computeGenerations(graph: TreeGraph): Map<string, number> {
  const familyById = new Map(graph.families.map((f) => [f.id, f]));

  // adjacency: gen(to) = gen(from) + delta
  const adj = new Map<string, { to: string; d: number }[]>();
  const add = (from: string, to: string, d: number) =>
    adj.set(from, [...(adj.get(from) ?? []), { to, d }]);

  for (const l of graph.childLinks) {
    const f = familyById.get(l.familyId);
    if (!f) continue;
    for (const p of [f.partner1Id, f.partner2Id]) {
      if (!p) continue;
      add(p, l.childId, 1); // child one row below each parent
      add(l.childId, p, -1); // parent one row above child
    }
  }
  for (const f of graph.families) {
    if (f.partner1Id && f.partner2Id) {
      add(f.partner1Id, f.partner2Id, 0); // partners share a row
      add(f.partner2Id, f.partner1Id, 0);
    }
  }

  // BFS each connected component, propagating relative generations.
  const gen = new Map<string, number>();
  for (const person of graph.people) {
    if (gen.has(person.id)) continue;
    gen.set(person.id, 0);
    const queue = [person.id];
    while (queue.length) {
      const u = queue.shift()!;
      const gu = gen.get(u)!;
      for (const { to, d } of adj.get(u) ?? []) {
        if (!gen.has(to)) {
          gen.set(to, gu + d);
          queue.push(to);
        }
        // else keep the first assignment (ignore inconsistent cross-gen edges)
      }
    }
  }

  // Normalize so the topmost row is 0.
  if (gen.size) {
    const min = Math.min(...gen.values());
    for (const [k, v] of gen) gen.set(k, v - min);
  }

  // Safety: guarantee every parent stays strictly above its children, fixing
  // any residual conflicts (cross-generational marriages, data anomalies).
  let changed = true;
  let guard = 0;
  while (changed && guard++ <= graph.people.length) {
    changed = false;
    for (const l of graph.childLinks) {
      const f = familyById.get(l.familyId);
      if (!f) continue;
      for (const p of [f.partner1Id, f.partner2Id]) {
        if (!p) continue;
        if ((gen.get(p) ?? 0) >= (gen.get(l.childId) ?? 0)) {
          gen.set(l.childId, (gen.get(p) ?? 0) + 1);
          changed = true;
        }
      }
    }
  }
  return gen;
}

/**
 * Tidy genealogy layout. Generations map to rows (Y). X is assigned by recursive
 * subtree packing: each family unit (a couple + all its descendants) reserves a
 * disjoint horizontal interval, so two families can never overlap. A couple is
 * centered over its children's span.
 */
export function layoutTree(
  graph: TreeGraph,
  opts: { duplicateSpouses?: boolean } = {},
): LayoutResult {
  // 2D draws cross-lineage spouses as duplicates; 3D links them directly, so it
  // passes duplicateSpouses:false to keep one node per person.
  const duplicateSpouses = opts.duplicateSpouses !== false;
  const { childrenOfFamily, parentsOf } = buildParentIndex(graph);
  const gen = computeGenerations(graph);
  const personById = new Map(graph.people.map((p) => [p.id, p]));

  const hasParents = (id: string) => (parentsOf.get(id)?.length ?? 0) > 0;

  // Families each person partners in.
  const familiesAsPartner = new Map<string, GraphFamily[]>();
  for (const fam of graph.families) {
    for (const pid of [fam.partner1Id, fam.partner2Id]) {
      if (pid)
        familiesAsPartner.set(pid, [...(familiesAsPartner.get(pid) ?? []), fam]);
    }
  }

  const childCountOf = (id: string) => {
    let c = 0;
    for (const f of familiesAsPartner.get(id) ?? [])
      c += (childrenOfFamily.get(f.id) ?? []).length;
    return c;
  };

  // For each family pick an "anchor" partner that owns the descent block. A
  // partner who married in (no parents of their own in the tree) is rendered
  // adjacent to the anchor. A partner who HAS their own lineage stays in that
  // lineage — the couples are just joined without drawing a long line.
  const familyAnchor = (f: GraphFamily): string | undefined => {
    const a = f.partner1Id;
    const b = f.partner2Id;
    if (!a) return b ?? undefined;
    if (!b) return a;
    const ha = hasParents(a);
    const hb = hasParents(b);
    if (ha && !hb) return a; // keep the blood relative in their lineage
    if (hb && !ha) return b;
    const ca = childCountOf(a);
    const cb = childCountOf(b);
    if (ca !== cb) return ca > cb ? a : b; // continue the larger line
    return a < b ? a : b;
  };
  const familySpouse = (f: GraphFamily): string | undefined => {
    const anchor = familyAnchor(f);
    if (!anchor) return undefined;
    const other = f.partner1Id === anchor ? f.partner2Id : f.partner1Id;
    // Only attach a married-in spouse (one with no birth family in the tree).
    return other && !hasParents(other) ? other : undefined;
  };

  const yearOf = (id: string) => {
    const m = (personById.get(id)?.birthDate ?? "").match(/\d{3,4}/);
    return m ? parseInt(m[0], 10) : Number.POSITIVE_INFINITY;
  };
  const orderPeople = (ids: string[]) =>
    [...new Set(ids)].sort((a, b) => {
      const ya = yearOf(a);
      const yb = yearOf(b);
      if (ya !== yb) return ya - yb;
      return (personById.get(a)?.firstName ?? "").localeCompare(
        personById.get(b)?.firstName ?? "",
      );
    });

  // The non-anchor partner rendered adjacent to the anchor. If that spouse has
  // their own lineage in the tree, a DUPLICATE node is drawn beside the anchor
  // (so the couple + their children show together) while the real person still
  // appears in their own birth family — i.e. shown twice if you trace back far.
  const adjacentSpouseRef = (
    person: string,
  ):
    | { layoutId: string; personId: string; dup: boolean; echoFamilyId?: string }
    | undefined => {
    const fams = familiesAsPartner.get(person) ?? [];
    // Prefer a family this person anchors — shows their couple AND children.
    for (const f of fams) {
      if (familyAnchor(f) !== person) continue;
      const other = f.partner1Id === person ? f.partner2Id : f.partner1Id;
      if (!other) continue;
      if (!hasParents(other))
        return { layoutId: other, personId: other, dup: false };
      if (duplicateSpouses)
        return { layoutId: `dup:${f.id}:${other}`, personId: other, dup: true };
      // No-duplicate mode: the cross-lineage spouse stays in their own lineage
      // and is joined by a real link, so don't place them adjacent here.
    }
    if (!duplicateSpouses) return undefined;
    // Otherwise this person is the non-anchor partner: still show the couple in
    // THIS person's own family by drawing the spouse as a duplicate beside them,
    // plus their direct children as leaf duplicates (echoFamilyId). Children's
    // full subtrees remain under the anchor's copy elsewhere.
    for (const f of fams) {
      const other = f.partner1Id === person ? f.partner2Id : f.partner1Id;
      if (other)
        return {
          layoutId: `dup:${f.id}:${other}`,
          personId: other,
          dup: true,
          echoFamilyId: f.id,
        };
    }
    return undefined;
  };
  // Married-in spouses (no birth family of their own) appear only beside their
  // partner, so they aren't also processed as roots.
  const adjacentSpouses = new Set<string>();
  for (const f of graph.families) {
    const anchor = familyAnchor(f);
    if (!anchor) continue;
    const other = f.partner1Id === anchor ? f.partner2Id : f.partner1Id;
    if (other && !hasParents(other)) adjacentSpouses.add(other);
  }
  const blockChildren = (anchor: string): string[] => {
    const kids: string[] = [];
    for (const f of familiesAsPartner.get(anchor) ?? []) {
      if (familyAnchor(f) === anchor)
        kids.push(...(childrenOfFamily.get(f.id) ?? []));
    }
    return orderPeople(kids);
  };

  const COUPLE_W = 2;
  const LEAF_W = 1;
  const SIBLING_GAP = 0.28;
  const ROOT_GAP = 0.7;

  // Bottom-up subtree width (in node units).
  const widthMemo = new Map<string, number>();
  const widthGuard = new Set<string>();
  // Echo children = a non-anchor copy's direct children, shown as leaf dups.
  const echoChildren = (person: string): string[] => {
    const sp = adjacentSpouseRef(person);
    if (!sp?.echoFamilyId) return [];
    return orderPeople(childrenOfFamily.get(sp.echoFamilyId) ?? []);
  };
  const widthOf = (anchor: string): number => {
    const cached = widthMemo.get(anchor);
    if (cached !== undefined) return cached;
    if (widthGuard.has(anchor)) return COUPLE_W;
    widthGuard.add(anchor);
    const coupleW = adjacentSpouseRef(anchor) ? COUPLE_W : LEAF_W;
    const kids = blockChildren(anchor).filter((k) => !widthGuard.has(k));
    let childrenW = 0;
    if (kids.length) {
      childrenW =
        kids.reduce((s, k) => s + widthOf(k), 0) +
        SIBLING_GAP * (kids.length - 1);
    } else {
      const echo = echoChildren(anchor);
      if (echo.length)
        childrenW = echo.length * LEAF_W + SIBLING_GAP * (echo.length - 1);
    }
    const w = Math.max(coupleW, childrenW);
    widthGuard.delete(anchor);
    widthMemo.set(anchor, w);
    return w;
  };

  // Place a block at a given left edge; returns the couple's center x.
  const x = new Map<string, number>();
  const placed = new Set<string>();
  // Duplicate nodes (spouse copies + echo children): layoutId -> info.
  const dupNodes = new Map<string, { personId: string; gen: number }>();
  // Partner connections to draw: real id <-> spouse layout id.
  const adjacencies: { anchorId: string; spouseLayoutId: string }[] = [];
  // Parent connectors for echo children (couple copy -> leaf-dup child).
  const echoEdges: { parentId: string; childLayoutId: string }[] = [];

  const placeBlock = (anchor: string, left: number): number => {
    if (placed.has(anchor)) return x.get(anchor) ?? left;
    placed.add(anchor);
    const sp = adjacentSpouseRef(anchor);
    let members = [anchor];
    if (sp) {
      members = [anchor, sp.layoutId];
      if (sp.dup)
        dupNodes.set(sp.layoutId, {
          personId: sp.personId,
          gen: gen.get(anchor) ?? 0,
        });
      else placed.add(sp.layoutId); // real married-in spouse is homed here
      adjacencies.push({ anchorId: anchor, spouseLayoutId: sp.layoutId });
    }
    const w = widthOf(anchor);
    const kids = blockChildren(anchor).filter((k) => !placed.has(k));
    const echo = kids.length ? [] : echoChildren(anchor);

    let center: number;
    if (kids.length) {
      const childrenW =
        kids.reduce((s, k) => s + widthOf(k), 0) +
        SIBLING_GAP * (kids.length - 1);
      let cur = left + (w - childrenW) / 2;
      const childCenters: number[] = [];
      for (const k of kids) {
        childCenters.push(placeBlock(k, cur));
        cur += widthOf(k) + SIBLING_GAP;
      }
      center = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
    } else if (echo.length) {
      // Lay the couple's direct children below as leaf duplicates.
      const childrenW = echo.length * LEAF_W + SIBLING_GAP * (echo.length - 1);
      let cur = left + (w - childrenW) / 2;
      const childCenters: number[] = [];
      for (const cid of echo) {
        const layoutId = `echo:${anchor}:${cid}`;
        const cx = cur + LEAF_W / 2;
        x.set(layoutId, cx);
        dupNodes.set(layoutId, {
          personId: cid,
          gen: gen.get(cid) ?? (gen.get(anchor) ?? 0) + 1,
        });
        echoEdges.push({ parentId: anchor, childLayoutId: layoutId });
        childCenters.push(cx);
        cur += LEAF_W + SIBLING_GAP;
      }
      center = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
    } else {
      center = left + w / 2;
    }
    // Partners are placed 1 unit apart, centered on the block center.
    const start = center - (members.length - 1) / 2;
    members.forEach((m, i) => x.set(m, start + i));
    return center;
  };

  // Drive from topmost roots (no parents, not a married-in spouse), top gens first.
  const roots = graph.people
    .filter((p) => !hasParents(p.id) && !adjacentSpouses.has(p.id))
    .map((p) => p.id)
    .sort((a, b) => {
      const ga = gen.get(a) ?? 0;
      const gb = gen.get(b) ?? 0;
      if (ga !== gb) return ga - gb;
      const ya = yearOf(a);
      const yb = yearOf(b);
      if (ya !== yb) return ya - yb;
      return a.localeCompare(b);
    });

  let cursor = 0;
  for (const r of roots) {
    if (placed.has(r)) continue;
    placeBlock(r, cursor);
    cursor += widthOf(r) + ROOT_GAP;
  }
  // Fallback for anything unreached (cycles / disconnected oddities).
  for (const p of graph.people) {
    if (!placed.has(p.id)) {
      placed.add(p.id);
      x.set(p.id, cursor);
      cursor += LEAF_W + ROOT_GAP;
    }
  }

  // Center on x = 0.
  const allX = [...x.values()];
  const midX = allX.length ? (Math.min(...allX) + Math.max(...allX)) / 2 : 0;

  const generationCount = new Set(
    graph.people.map((p) => gen.get(p.id) ?? 0),
  ).size;

  const nodes = new Map<string, LaidOutNode>();
  for (const p of graph.people) {
    nodes.set(p.id, {
      id: p.id,
      refId: p.id,
      isDuplicate: false,
      person: p,
      x: (x.get(p.id) ?? 0) - midX,
      gen: gen.get(p.id) ?? 0,
    });
  }
  // Duplicate nodes: spouse copies (same row as their partner) and echo children
  // (one row below) — each carries its resolved generation.
  for (const [layoutId, info] of dupNodes) {
    const person = personById.get(info.personId);
    if (!person) continue;
    nodes.set(layoutId, {
      id: layoutId,
      refId: info.personId,
      isDuplicate: true,
      person,
      x: (x.get(layoutId) ?? 0) - midX,
      gen: info.gen,
    });
  }

  // Partner edges. With duplicates (2D) they connect each anchor to the spouse
  // copy beside it (always adjacent). Without duplicates (3D) they connect the
  // two real people directly — a real link even across distant lineages.
  const partnerEdges: PartnerEdge[] = duplicateSpouses
    ? adjacencies.map((a) => ({
        id: `pe:${a.anchorId}:${a.spouseLayoutId}`,
        aId: a.anchorId,
        bId: a.spouseLayoutId,
      }))
    : graph.families
        .filter((f) => f.partner1Id && f.partner2Id)
        .map((f) => ({ id: f.id, aId: f.partner1Id!, bId: f.partner2Id! }));

  const parentEdges: ParentEdge[] = [];
  for (const fam of graph.families) {
    const kids = childrenOfFamily.get(fam.id) ?? [];
    const parents = [fam.partner1Id, fam.partner2Id].filter(
      (p): p is string => !!p,
    );
    const anchorId = familyAnchor(fam);
    for (const childId of kids) {
      parentEdges.push({
        id: `${fam.id}-${childId}`,
        familyId: fam.id,
        childId,
        parentIds: parents,
        anchorId,
      });
    }
  }
  // Connectors from a non-anchor couple copy down to its echo (leaf-dup) children.
  for (const e of echoEdges) {
    parentEdges.push({
      id: `echo-${e.childLayoutId}`,
      familyId: "",
      childId: e.childLayoutId,
      parentIds: [e.parentId],
      anchorId: e.parentId,
    });
  }

  const gens = [...nodes.values()].map((n) => n.gen);
  const xs = [...nodes.values()].map((n) => n.x);
  return {
    nodes,
    partnerEdges,
    parentEdges,
    generations: generationCount,
    bounds: {
      minX: xs.length ? Math.min(...xs) : 0,
      maxX: xs.length ? Math.max(...xs) : 0,
      minGen: gens.length ? Math.min(...gens) : 0,
      maxGen: gens.length ? Math.max(...gens) : 0,
    },
  };
}

export interface FlatLayout {
  nodes: {
    id: string;
    refId: string;
    isDuplicate: boolean;
    x: number;
    gen: number;
    firstName: string;
    lastName: string;
    gender: string;
    birthDate: string | null;
    deathDate: string | null;
  }[];
  partnerEdges: { id: string; aId: string; bId: string }[];
  parentEdges: {
    id: string;
    childId: string;
    parentIds: string[];
    anchorId?: string;
  }[];
}

/** Flatten the layout (Maps → arrays) so it can cross the server→client boundary. */
export function serializeLayout(r: LayoutResult): FlatLayout {
  return {
    nodes: [...r.nodes.values()].map((n) => ({
      id: n.id,
      refId: n.refId,
      isDuplicate: n.isDuplicate,
      x: n.x,
      gen: n.gen,
      firstName: n.person.firstName,
      lastName: n.person.lastName,
      gender: n.person.gender,
      birthDate: n.person.birthDate ?? null,
      deathDate: n.person.deathDate ?? null,
    })),
    partnerEdges: r.partnerEdges.map((e) => ({
      id: e.id,
      aId: e.aId,
      bId: e.bId,
    })),
    parentEdges: r.parentEdges.map((e) => ({
      id: e.id,
      childId: e.childId,
      parentIds: e.parentIds,
      anchorId: e.anchorId,
    })),
  };
}

/** "1954–2001", "b. 1954", "d. 2001", or "" — for node labels. */
export function lifespan(p: {
  birthDate?: string | null;
  deathDate?: string | null;
}): string {
  const birth = (p.birthDate ?? "").match(/\d{3,4}/)?.[0];
  const death = (p.deathDate ?? "").match(/\d{3,4}/)?.[0];
  if (birth && death) return `${birth}–${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return "";
}

export function fullName(p: GraphPerson): string {
  return `${p.firstName} ${p.lastName}`.trim();
}
