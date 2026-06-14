"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import {
  Crosshair,
  UserCog,
  X,
  UserPlus,
  Users,
  Heart,
  Baby,
  User,
  FlipHorizontal,
  FlipVertical,
} from "lucide-react";
import { lifespan, layoutTree, serializeLayout, type TreeGraph } from "@/lib/graph";
import { QuickRelativeDialog } from "@/components/person/quick-relative-dialog";
import { ProfilePopup } from "@/components/person/profile-popup";
import type { RelationKind } from "@/lib/relationships";

// Same icons/labels/order as the profile's "Add a relative" section.
const RELATIVE_KINDS: {
  kind: RelationKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { kind: "parent", label: "Parent", icon: UserPlus },
  { kind: "sibling", label: "Sibling", icon: Users },
  { kind: "partner", label: "Partner", icon: Heart },
  { kind: "child", label: "Child", icon: Baby },
];

interface FlatNode {
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
}

const NODE_W = 168;
const NODE_H = 34;
// Vertical: generations down (Y), siblings across (X).
const V_SIB = 184; // ≥ NODE_W so side-by-side partners don't overlap
const V_GEN = 84;
// Horizontal: generations across (X), siblings down (Y).
const H_GEN = 220;
const H_SIB = 42; // ≥ NODE_H so stacked partners don't overlap

type Orientation = "vertical" | "horizontal";
const ORIENT_KEY = "roots:tree2d-orientation";

const GENDER_COLOR: Record<string, string> = {
  MALE: "#3b82f6",
  FEMALE: "#ec4899",
  UNKNOWN: "#64748b",
};

type ContextMenu = { x: number; y: number; nodeId: string };

export function TreeCanvas2D({
  treeId,
  graph,
  focusId,
  mainId,
  mainName,
}: {
  treeId: string;
  graph: TreeGraph;
  focusId?: string;
  mainId?: string;
  mainName?: string;
}) {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [selected, setSelected] = useState<string | undefined>(focusId);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<ContextMenu | null>(null);
  const [orient, setOrient] = useState<Orientation>("vertical");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<{
    kind: RelationKind;
    anchorId: string;
    anchorLastName: string;
  } | null>(null);

  // Manual double-click detection: d3-zoom's pointer handling swallows the
  // native dblclick on SVG groups, so we time consecutive clicks ourselves.
  const lastClick = useRef<{ id: string; t: number }>({ id: "", t: 0 });

  // Relationship maps from the full (unfiltered) graph — drive the collapse
  // toggle and the descendant/partner removal when collapsing.
  const base = useMemo(() => {
    const familyById = new Map(graph.families.map((f) => [f.id, f]));
    const childrenOf = new Map<string, string[]>();
    const partnersOf = new Map<string, string[]>();
    const parentsOf = new Map<string, string[]>();
    for (const l of graph.childLinks) {
      const f = familyById.get(l.familyId);
      if (!f) continue;
      const ps = [f.partner1Id, f.partner2Id].filter((x): x is string => !!x);
      parentsOf.set(l.childId, [...(parentsOf.get(l.childId) ?? []), ...ps]);
      for (const p of ps)
        childrenOf.set(p, [...(childrenOf.get(p) ?? []), l.childId]);
    }
    for (const f of graph.families) {
      if (f.partner1Id && f.partner2Id) {
        partnersOf.set(f.partner1Id, [
          ...(partnersOf.get(f.partner1Id) ?? []),
          f.partner2Id,
        ]);
        partnersOf.set(f.partner2Id, [
          ...(partnersOf.get(f.partner2Id) ?? []),
          f.partner1Id,
        ]);
      }
    }
    return { childrenOf, partnersOf, parentsOf };
  }, [graph]);

  // Lay out (client-side) the graph with collapsed subtrees removed so the tree
  // re-packs optimally and descendants' married-in partners disappear too.
  const data = useMemo(() => {
    const hidden = new Set<string>();
    if (collapsed.size) {
      const { childrenOf, partnersOf, parentsOf } = base;
      const marriedIn = (id: string) =>
        (parentsOf.get(id)?.length ?? 0) === 0;
      const stack: string[] = [];
      for (const c of collapsed) stack.push(...(childrenOf.get(c) ?? []));
      while (stack.length) {
        const d = stack.pop()!;
        if (hidden.has(d)) continue;
        hidden.add(d);
        for (const p of partnersOf.get(d) ?? []) if (marriedIn(p)) hidden.add(p);
        stack.push(...(childrenOf.get(d) ?? []));
      }
    }

    let filtered: TreeGraph = graph;
    if (hidden.size) {
      const families = graph.families.filter(
        (f) =>
          ![f.partner1Id, f.partner2Id].some((id) => id && hidden.has(id)),
      );
      const familyIds = new Set(families.map((f) => f.id));
      filtered = {
        people: graph.people.filter((p) => !hidden.has(p.id)),
        families,
        childLinks: graph.childLinks.filter(
          (l) => !hidden.has(l.childId) && familyIds.has(l.familyId),
        ),
      };
    }
    return serializeLayout(layoutTree(filtered));
  }, [graph, collapsed, base]);

  const nodeById = useMemo(
    () => new Map(data.nodes.map((n) => [n.id, n])),
    [data.nodes],
  );

  const horizontal = orient === "horizontal";
  const px = (n: FlatNode) => (horizontal ? n.gen * H_GEN : n.x * V_SIB);
  const py = (n: FlatNode) => (horizontal ? n.x * H_SIB : n.gen * V_GEN);

  // Load saved orientation preference once.
  useEffect(() => {
    const saved = window.localStorage.getItem(ORIENT_KEY);
    if (saved === "horizontal" || saved === "vertical") setOrient(saved);
  }, []);
  function toggleOrient() {
    setOrient((o) => {
      const next = o === "vertical" ? "horizontal" : "vertical";
      window.localStorage.setItem(ORIENT_KEY, next);
      return next;
    });
  }

  const zbRef = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(
    null,
  );
  const didFit = useRef(false);
  const fittedOrient = useRef<Orientation | null>(null);
  // When set, keep this node visually pinned across the next re-layout.
  const anchor = useRef<{ id: string; sx: number; sy: number } | null>(null);

  // Set up d3-zoom once.
  useEffect(() => {
    if (!svgRef.current) return;
    const sel = select<SVGSVGElement, unknown>(svgRef.current);
    const zb = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.08, 2.5])
      .on("zoom", (e) => setTransform(e.transform));
    sel.call(zb);
    sel.on("dblclick.zoom", null); // let node double-clicks through
    zbRef.current = zb;
  }, []);

  // Initial fit on mount; on collapse/expand, pin the toggled node in place.
  useEffect(() => {
    const svg = svgRef.current;
    const zb = zbRef.current;
    if (!svg || !zb) return;
    const sel = select<SVGSVGElement, unknown>(svg);

    const pin = anchor.current;
    if (pin) {
      anchor.current = null;
      const n = nodeById.get(pin.id);
      if (n) {
        const k = transform.k; // preserve zoom
        const next = zoomIdentity
          .translate(pin.sx - k * px(n), pin.sy - k * py(n))
          .scale(k);
        sel.call(zb.transform, next);
      }
      return;
    }

    // Fit on first render and whenever orientation flips.
    const needFit = !didFit.current || fittedOrient.current !== orient;
    if (!needFit || data.nodes.length === 0) return;
    didFit.current = true;
    fittedOrient.current = orient;
    const xs = data.nodes.map(px);
    const ys = data.nodes.map(py);
    const minX = Math.min(...xs) - NODE_W;
    const maxX = Math.max(...xs) + NODE_W;
    const minY = Math.min(...ys) - NODE_H;
    const maxY = Math.max(...ys) + NODE_H;
    const { width, height } = svg.getBoundingClientRect();
    const k = Math.min(width / (maxX - minX), height / (maxY - minY), 1.2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const focus = focusId ? nodeById.get(focusId) : undefined;
    const tx = width / 2 - (focus ? px(focus) : cx) * k;
    const ty = height / 2 - (focus ? py(focus) : cy) * k;
    sel.call(zb.transform, zoomIdentity.translate(tx, ty).scale(focus ? 1 : k));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, orient]);

  // Toggle collapse on a node, pinning it so the view doesn't jump.
  function toggleCollapse(n: FlatNode, isCollapsed: boolean) {
    const [sx, sy] = transform.apply([px(n), py(n)]);
    anchor.current = { id: n.id, sx, sy };
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (isCollapsed) {
        next.delete(n.id);
        for (const pp of base.partnersOf.get(n.id) ?? []) next.delete(pp);
      } else {
        next.add(n.id);
      }
      return next;
    });
  }

  function openProfile(id: string) {
    setProfileId(id);
  }
  // Record a person's current screen position so it stays put across the
  // re-layout that follows setting/clearing the main person.
  function pinPerson(personId: string) {
    const n = nodeById.get(personId);
    if (!n) return;
    const [sx, sy] = transform.apply([px(n), py(n)]);
    anchor.current = { id: personId, sx, sy };
  }
  function setMain(id: string) {
    pinPerson(id);
    router.push(`/tree/${treeId}/2d?main=${id}`);
  }
  function clearMain() {
    if (mainId) pinPerson(mainId);
    router.push(`/tree/${treeId}/2d`);
  }

  const menuNode = menu ? nodeById.get(menu.nodeId) : undefined;

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-950">
      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onClick={() => setMenu(null)}
      >
        <g transform={transform.toString()}>
          {data.parentEdges.map((e) => {
            const child = nodeById.get(e.childId);
            const allParents = e.parentIds
              .map((id) => nodeById.get(id))
              .filter((n): n is FlatNode => !!n);
            if (!child || allParents.length === 0) return null;
            // Anchor the connector to the parent the child is laid out under,
            // and only include co-parents adjacent to it — so a far-away
            // cross-marriage co-parent doesn't drag a long line across.
            const anchorNode = e.anchorId
              ? nodeById.get(e.anchorId)
              : undefined;
            const ref = anchorNode ?? allParents[0];
            const parents = allParents.filter(
              (p) => Math.abs(p.x - ref.x) <= 2.5,
            );
            if (parents.length === 0) parents.push(ref);
            // Elbow from the couple anchor out to the child, oriented along the
            // generation axis (down when vertical, right when horizontal).
            let d: string;
            if (horizontal) {
              const ay =
                parents.reduce((s, p) => s + py(p), 0) / parents.length;
              const ax = Math.max(...parents.map(px)) + NODE_W / 2;
              const cLeft = px(child) - NODE_W / 2;
              const midX = (ax + cLeft) / 2;
              d = `M ${ax} ${ay} H ${midX} V ${py(child)} H ${cLeft}`;
            } else {
              const ax =
                parents.reduce((s, p) => s + px(p), 0) / parents.length;
              const ay = Math.max(...parents.map(py)) + NODE_H / 2;
              const cTop = py(child) - NODE_H / 2;
              const midY = (ay + cTop) / 2;
              d = `M ${ax} ${ay} V ${midY} H ${px(child)} V ${cTop}`;
            }
            return (
              <path
                key={e.id}
                d={d}
                fill="none"
                stroke="currentColor"
                className="text-slate-300 dark:text-slate-700"
                strokeWidth={1.5}
              />
            );
          })}

          {data.partnerEdges.map((e) => {
            const a = nodeById.get(e.aId);
            const b = nodeById.get(e.bId);
            if (!a || !b) return null;
            // Couples are normally adjacent; skip the rare cross-marriage link
            // that would otherwise draw a long line across the chart.
            if (a.gen !== b.gen || Math.abs(a.x - b.x) > 2.5) return null;
            return (
              <line
                key={e.id}
                x1={px(a)}
                y1={py(a)}
                x2={px(b)}
                y2={py(b)}
                stroke="currentColor"
                className="text-rose-300 dark:text-rose-800"
                strokeWidth={2.5}
              />
            );
          })}

          {data.nodes.map((n) => {
            const span = lifespan(n);
            const isSel = n.refId === selected;
            const isMain = n.refId === mainId;
            // Duplicate spouse nodes never own a subtree here.
            const kids = n.isDuplicate ? [] : base.childrenOf.get(n.refId) ?? [];
            const hasKids = kids.length > 0;
            // Subtree is collapsed if its children aren't currently shown
            // (whether this node or its partner triggered the collapse).
            const isCollapsed = hasKids && kids.every((c) => !nodeById.has(c));
            return (
              <g
                key={n.id}
                transform={`translate(${px(n) - NODE_W / 2}, ${py(n) - NODE_H / 2})`}
                className="cursor-pointer"
                onClick={(ev) => {
                  ev.stopPropagation();
                  setMenu(null);
                  const now = Date.now();
                  if (
                    lastClick.current.id === n.refId &&
                    now - lastClick.current.t < 350
                  ) {
                    lastClick.current = { id: "", t: 0 };
                    openProfile(n.refId);
                  } else {
                    lastClick.current = { id: n.refId, t: now };
                    setSelected(n.refId);
                  }
                }}
                onContextMenu={(ev) => {
                  ev.preventDefault();
                  ev.stopPropagation();
                  setSelected(n.refId);
                  setMenu({ x: ev.clientX, y: ev.clientY, nodeId: n.refId });
                }}
              >
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={7}
                  strokeDasharray={n.isDuplicate ? "3 3" : undefined}
                  className={
                    isMain
                      ? "fill-white stroke-amber-500 dark:fill-slate-800"
                      : isSel
                        ? "fill-white stroke-primary dark:fill-slate-800"
                        : n.isDuplicate
                          ? "fill-slate-50 stroke-slate-300 dark:fill-slate-800/60 dark:stroke-slate-600"
                          : "fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700"
                  }
                  strokeWidth={isMain || isSel ? 2 : 1}
                />
                <circle
                  cx={13}
                  cy={NODE_H / 2}
                  r={6}
                  fill={GENDER_COLOR[n.gender] ?? GENDER_COLOR.UNKNOWN}
                />
                <text
                  x={26}
                  y={NODE_H / 2 + 4}
                  className="fill-foreground text-[11px] font-medium"
                >
                  {truncate(`${n.firstName} ${n.lastName}`, span ? 13 : 22)}
                  {span ? (
                    <tspan className="fill-muted-foreground font-normal">
                      {"  "}
                      {span}
                    </tspan>
                  ) : null}
                </text>
                {hasKids ? (
                  <g
                    onClick={(ev) => {
                      ev.stopPropagation();
                      toggleCollapse(n, isCollapsed);
                    }}
                  >
                    <circle
                      cx={NODE_W - 11}
                      cy={NODE_H / 2}
                      r={7}
                      className="fill-muted stroke-border"
                      strokeWidth={1}
                    />
                    <text
                      x={NODE_W - 11}
                      y={NODE_H / 2 + 4}
                      textAnchor="middle"
                      className="fill-foreground text-[12px] font-bold"
                    >
                      {isCollapsed ? "+" : "−"}
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Orientation toggle */}
      <button
        onClick={toggleOrient}
        className="absolute right-3 top-3 flex items-center gap-2 rounded-md border bg-background/90 px-3 py-1.5 text-sm shadow-sm backdrop-blur transition-colors hover:bg-muted"
        title={`Switch to ${horizontal ? "vertical" : "horizontal"} layout`}
      >
        {horizontal ? (
          <FlipVertical className="h-4 w-4" />
        ) : (
          <FlipHorizontal className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {horizontal ? "Horizontal" : "Vertical"}
        </span>
      </button>

      {/* Main-person banner */}
      {mainId ? (
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md border bg-background/90 px-3 py-1.5 text-sm shadow-sm backdrop-blur">
          <UserCog className="h-4 w-4 text-amber-500" />
          <span>
            Focused on <span className="font-medium">{mainName}</span>
          </span>
          <button
            onClick={clearMain}
            className="ml-1 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear main person"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Context menu */}
      {menu && menuNode ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-52 overflow-hidden rounded-md border bg-popover py-1 text-sm shadow-lg"
            style={{ left: menu.x, top: menu.y }}
          >
            <div className="border-b px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {menuNode.firstName} {menuNode.lastName}
            </div>
            <MenuItem
              onClick={() => {
                openProfile(menu.nodeId);
                setMenu(null);
              }}
            >
              <User className="mr-2 h-4 w-4" />
              Open profile
            </MenuItem>
            {mainId === menu.nodeId ? (
              <MenuItem
                onClick={() => {
                  clearMain();
                  setMenu(null);
                }}
              >
                <Crosshair className="mr-2 h-4 w-4" />
                Clear main person
              </MenuItem>
            ) : (
              <MenuItem
                onClick={() => {
                  setMain(menu.nodeId);
                  setMenu(null);
                }}
              >
                <Crosshair className="mr-2 h-4 w-4" />
                Set as main person
              </MenuItem>
            )}
            <div className="my-1 border-t" />
            <div className="px-3 py-1 text-xs font-semibold text-muted-foreground">
              Add a relative
            </div>
            {RELATIVE_KINDS.map(({ kind, label, icon: Icon }) => (
              <MenuItem
                key={kind}
                onClick={() => {
                  setQuickAdd({
                    kind,
                    anchorId: menu.nodeId,
                    anchorLastName: menuNode.lastName,
                  });
                  setMenu(null);
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </MenuItem>
            ))}
          </div>
        </>
      ) : null}

      {/* Add-relative dialog (from context menu) */}
      <QuickRelativeDialog
        treeId={treeId}
        anchorId={quickAdd?.anchorId ?? null}
        anchorLastName={quickAdd?.anchorLastName ?? ""}
        kind={quickAdd?.kind ?? null}
        onOpenChange={(o) => !o && setQuickAdd(null)}
        afterAdd={() => router.refresh()}
      />

      {/* Profile popup (double-click or context menu → Open profile) */}
      <ProfilePopup
        treeId={treeId}
        personId={profileId}
        onOpenChange={(o) => !o && setProfileId(null)}
        onOpenPerson={(id) => setProfileId(id)}
        onSetMain={(id) => {
          setProfileId(null);
          setMain(id);
        }}
      />

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
        Scroll to zoom · drag to pan · double-click to open profile · right-click for options
      </div>
    </div>
  );
}

function MenuItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center px-3 py-1.5 text-left hover:bg-muted"
    >
      {children}
    </button>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
