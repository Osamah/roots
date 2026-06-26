"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Button } from "@/components/ui/button";
import { lifespan } from "@/lib/graph";
import type { Layout3DData, Node3D } from "@/lib/layout3d";

const GENDER_COLOR: Record<string, string> = {
  MALE: "#3b82f6",
  FEMALE: "#ec4899",
  UNKNOWN: "#94a3b8",
};
const NODE_R = 1.3;
const MAX_LABELS = 45;
const Z_GAP = 16; // depth between fanned-out child subtrees

type Vec3 = [number, number, number];
type PosMap = Map<string, Vec3>;

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

// ---- axis-aligned (right-angle) connectors, like the 2D tree ----
function pushPath(arr: number[], pts: Vec3[]) {
  for (let i = 0; i < pts.length - 1; i++) arr.push(...pts[i], ...pts[i + 1]);
}
// Parent → child: drop down to a bus row, across in X, across in Z, down to child.
function pushParentElbow(arr: number[], a: Vec3, b: Vec3) {
  const busY = (a[1] + b[1]) / 2;
  pushPath(arr, [
    a,
    [a[0], busY, a[2]],
    [b[0], busY, a[2]],
    [b[0], busY, b[2]],
    [b[0], b[1], b[2]],
  ]);
}
// Same-row link (couple / cross-family): across X, across Z, then Y if needed.
function pushFlatElbow(arr: number[], a: Vec3, b: Vec3) {
  pushPath(arr, [a, [b[0], a[1], a[2]], [b[0], a[1], b[2]], [b[0], b[1], b[2]]]);
}
function geomFrom(arr: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
  return g;
}

function Nodes({
  nodes,
  posById,
  onSelect,
  onFocus,
}: {
  nodes: Node3D[];
  posById: PosMap;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    nodes.forEach((n, i) => {
      const p = posById.get(n.id) ?? [n.x, n.y, 0];
      dummy.position.set(p[0], p[1], p[2]);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tmpColor.set(GENDER_COLOR[n.gender] ?? GENDER_COLOR.UNKNOWN));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes, posById]);

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, nodes.length]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.instanceId != null) onSelect(nodes[e.instanceId].id);
      }}
      onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.instanceId != null) onFocus(nodes[e.instanceId].id);
      }}
    >
      <boxGeometry args={[NODE_R * 1.8, NODE_R * 1.8, NODE_R * 1.8]} />
      <meshStandardMaterial roughness={0.5} metalness={0.05} />
    </instancedMesh>
  );
}

function SelectionRing({ pos }: { pos?: Vec3 }) {
  if (!pos) return null;
  return (
    <mesh position={pos}>
      <boxGeometry args={[NODE_R * 2.4, NODE_R * 2.4, NODE_R * 2.4]} />
      <meshBasicMaterial color="#f59e0b" wireframe transparent opacity={0.9} />
    </mesh>
  );
}

function Edges({ data, posById }: { data: Layout3DData; posById: PosMap }) {
  const geoms = useMemo(() => {
    const parent: number[] = [];
    const partner: number[] = [];
    const cross: number[] = [];
    for (const e of data.parentEdges) {
      const a = posById.get(e.aId);
      const b = posById.get(e.bId);
      if (a && b) pushParentElbow(parent, a, b);
    }
    for (const e of data.partnerEdges) {
      const a = posById.get(e.aId);
      const b = posById.get(e.bId);
      if (a && b) pushFlatElbow(partner, a, b);
    }
    for (const e of data.crossEdges) {
      const a = posById.get(e.aId);
      const b = posById.get(e.bId);
      if (a && b) pushFlatElbow(cross, a, b);
    }
    return { parent: geomFrom(parent), partner: geomFrom(partner), cross: geomFrom(cross) };
  }, [data, posById]);
  return (
    <>
      <lineSegments geometry={geoms.parent}>
        <lineBasicMaterial color="#475569" transparent opacity={0.55} />
      </lineSegments>
      <lineSegments geometry={geoms.partner}>
        <lineBasicMaterial color="#fb7185" transparent opacity={0.9} />
      </lineSegments>
      <lineSegments geometry={geoms.cross}>
        <lineBasicMaterial color="#a855f7" transparent opacity={0.8} />
      </lineSegments>
    </>
  );
}

function Labels({ nodes, posById }: { nodes: Node3D[]; posById: PosMap }) {
  const { camera } = useThree();
  const [visible, setVisible] = useState<Node3D[]>([]);
  const frame = useRef(0);
  useFrame(() => {
    frame.current = (frame.current + 1) % 12;
    if (frame.current !== 0) return;
    const c = camera.position;
    const near = nodes
      .map((n) => {
        const p = posById.get(n.id) ?? [n.x, n.y, 0];
        return { n, d: (p[0] - c.x) ** 2 + (p[1] - c.y) ** 2 + (p[2] - c.z) ** 2 };
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_LABELS)
      .filter((s) => s.d < 110 * 110)
      .map((s) => s.n);
    setVisible(near);
  });
  return (
    <>
      {visible.map((n) => {
        const p = posById.get(n.id) ?? [n.x, n.y, 0];
        const span = lifespan(n);
        return (
          <Html
            key={n.id}
            position={[p[0], p[1] + NODE_R + 1.4, p[2]]}
            center
            zIndexRange={[10, 0]}
            style={{ pointerEvents: "none" }}
          >
            <div className="whitespace-nowrap rounded bg-slate-900/85 px-1.5 py-0.5 text-center text-[11px] leading-tight text-slate-100 shadow">
              {n.firstName} {n.lastName}
              {span ? <span className="block text-[10px] text-slate-400">{span}</span> : null}
            </div>
          </Html>
        );
      })}
    </>
  );
}

function CameraRig({
  focusPos,
  controlsRef,
}: {
  focusPos?: Vec3;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const target = useRef(new THREE.Vector3());
  const active = useRef(false);
  useEffect(() => {
    if (focusPos) {
      target.current.set(focusPos[0], focusPos[1], focusPos[2]);
      active.current = true;
    }
  }, [focusPos]);
  useFrame((state) => {
    if (!active.current || !controlsRef.current) return;
    const controls = controlsRef.current;
    controls.target.lerp(target.current, 0.12);
    const desired = new THREE.Vector3(
      target.current.x,
      target.current.y + 4,
      target.current.z + 26,
    );
    state.camera.position.lerp(desired, 0.12);
    controls.update();
    if (state.camera.position.distanceTo(desired) < 0.5) active.current = false;
  });
  return null;
}

// Initial camera + orbit target, computed from the data before the Canvas
// mounts so nothing has to fight OrbitControls afterwards. Frames the tree's
// full height (trees are far wider than tall — pan to explore horizontally).
function initialView(nodes: Node3D[]) {
  if (nodes.length === 0) return { pos: [0, 0, 80] as Vec3, target: [0, 0, 0] as Vec3 };
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const yRange = Math.max(...ys) - Math.min(...ys);
  const dist = Math.max(80, yRange * 1.6);
  return { pos: [cx, cy, dist] as Vec3, target: [cx, cy, 0] as Vec3 };
}

export function Roots3D({
  treeId,
  data,
  focusId,
}: {
  treeId: string;
  data: Layout3DData;
  focusId?: string;
}) {
  const router = useRouter();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(focusId);
  const [focusNodeId, setFocusNodeId] = useState<string | undefined>(focusId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Parent → ordered children, from the layout's parent edges.
  const { childrenByAnchor, parentAnchorOf } = useMemo(() => {
    const baseX = new Map(data.nodes.map((n) => [n.id, n.x]));
    const childrenByAnchor = new Map<string, string[]>();
    const parentAnchorOf = new Map<string, string>();
    for (const e of data.parentEdges) {
      childrenByAnchor.set(e.aId, [...(childrenByAnchor.get(e.aId) ?? []), e.bId]);
      parentAnchorOf.set(e.bId, e.aId);
    }
    for (const kids of childrenByAnchor.values())
      kids.sort((x, y) => (baseX.get(x) ?? 0) - (baseX.get(y) ?? 0));
    return { childrenByAnchor, parentAnchorOf };
  }, [data]);

  // Z per node: 0 by default (planar). When an ancestor family is "expanded",
  // each of its children's subtrees is pushed to its own depth layer.
  const zById = useMemo(() => {
    const z = new Map<string, number>();
    const order = [...data.nodes].sort((a, b) => b.y - a.y); // parents first
    for (const n of order) {
      const anchor = parentAnchorOf.get(n.id);
      if (anchor === undefined) {
        z.set(n.id, 0);
        continue;
      }
      const base = z.get(anchor) ?? 0;
      if (expanded.has(anchor)) {
        const kids = childrenByAnchor.get(anchor) ?? [];
        const idx = kids.indexOf(n.id);
        const mid = (kids.length - 1) / 2;
        z.set(n.id, base + (idx - mid) * Z_GAP);
      } else {
        z.set(n.id, base);
      }
    }
    return z;
  }, [data, expanded, parentAnchorOf, childrenByAnchor]);

  const posById = useMemo<PosMap>(() => {
    const m = new Map<string, Vec3>();
    for (const n of data.nodes) m.set(n.id, [n.x, n.y, zById.get(n.id) ?? 0]);
    return m;
  }, [data.nodes, zById]);

  const nodeById = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);
  const view = useMemo(() => initialView(data.nodes), [data.nodes]);

  useEffect(() => {
    if (focusId) {
      setSelectedId(focusId);
      setFocusNodeId(focusId);
    }
  }, [focusId]);

  const selectedNode = selectedId ? nodeById.get(selectedId) : undefined;
  const selectedPos = selectedId ? posById.get(selectedId) : undefined;
  const focusPos = focusNodeId ? posById.get(focusNodeId) : undefined;
  const selectedHasChildren = selectedId ? childrenByAnchor.has(selectedId) : false;
  const selectedExpanded = selectedId ? expanded.has(selectedId) : false;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="relative h-full w-full bg-slate-900">
      <Canvas camera={{ position: view.pos, fov: 55 }} dpr={[1, 1.75]}>
        <color attach="background" args={["#0f172a"]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[30, 40, 50]} intensity={1} />

        <Edges data={data} posById={posById} />
        <Nodes
          nodes={data.nodes}
          posById={posById}
          onSelect={setSelectedId}
          onFocus={(id) => {
            setSelectedId(id);
            setFocusNodeId(id);
          }}
        />
        <SelectionRing pos={selectedPos} />
        <Labels nodes={data.nodes} posById={posById} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={view.target}
          enableDamping
          dampingFactor={0.1}
          maxDistance={600}
          minDistance={6}
          screenSpacePanning
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
        <CameraRig focusPos={focusPos} controlsRef={controlsRef} />
      </Canvas>

      {selectedNode ? (
        <div className="absolute left-3 top-3 w-64 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="font-semibold">
            {selectedNode.firstName} {selectedNode.lastName}
          </div>
          {lifespan(selectedNode) ? (
            <div className="text-sm text-muted-foreground">{lifespan(selectedNode)}</div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setFocusNodeId(selectedNode.id)}>
              Focus
            </Button>
            {selectedHasChildren ? (
              <Button size="sm" variant="outline" onClick={() => toggleExpand(selectedNode.id)}>
                {selectedExpanded ? "Collapse depth" : "Expand in depth"}
              </Button>
            ) : null}
            <Button
              size="sm"
              onClick={() => router.push(`/tree/${treeId}/people?person=${selectedNode.id}`)}
            >
              Open profile
            </Button>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
        Drag to pan · right-drag to rotate · scroll to zoom · click a node, then “Expand in
        depth” to fan its branches · <span className="text-purple-400">purple</span> = cross-family
      </div>
    </div>
  );
}
