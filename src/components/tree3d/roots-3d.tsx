"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Billboard, Text } from "@react-three/drei";
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
const NODE_RADIUS = 1.4;
const MAX_LABELS = 60;

const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();

function Nodes({
  nodes,
  selectedId,
  onSelect,
  onFocus,
}: {
  nodes: Node3D[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    nodes.forEach((n, i) => {
      dummy.position.set(n.x, n.y, n.z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tmpColor.set(GENDER_COLOR[n.gender] ?? GENDER_COLOR.UNKNOWN));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [nodes]);

  return (
    <instancedMesh
      ref={meshRef}
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
      <sphereGeometry args={[NODE_RADIUS, 20, 20]} />
      <meshStandardMaterial roughness={0.45} metalness={0.1} />
    </instancedMesh>
  );
}

function SelectionRing({ node }: { node?: Node3D }) {
  if (!node) return null;
  return (
    <mesh position={[node.x, node.y, node.z]}>
      <sphereGeometry args={[NODE_RADIUS * 1.35, 24, 24]} />
      <meshBasicMaterial color="#f59e0b" wireframe transparent opacity={0.9} />
    </mesh>
  );
}

function Edges({ data, nodeById }: { data: Layout3DData; nodeById: Map<string, Node3D> }) {
  const parentGeo = useMemo(() => {
    const pts: number[] = [];
    for (const e of data.parentEdges) {
      const child = nodeById.get(e.childId);
      const parents = e.parentIds
        .map((id) => nodeById.get(id))
        .filter((n): n is Node3D => !!n);
      if (!child || !parents.length) continue;
      const ax = parents.reduce((s, p) => s + p.x, 0) / parents.length;
      const ay = parents.reduce((s, p) => s + p.y, 0) / parents.length;
      const az = parents.reduce((s, p) => s + p.z, 0) / parents.length;
      pts.push(ax, ay, az, child.x, child.y, child.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [data.parentEdges, nodeById]);

  const partnerGeo = useMemo(() => {
    const pts: number[] = [];
    for (const e of data.partnerEdges) {
      const a = nodeById.get(e.aId);
      const b = nodeById.get(e.bId);
      if (!a || !b) continue;
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [data.partnerEdges, nodeById]);

  return (
    <>
      <lineSegments geometry={parentGeo}>
        <lineBasicMaterial color="#64748b" transparent opacity={0.5} />
      </lineSegments>
      <lineSegments geometry={partnerGeo}>
        <lineBasicMaterial color="#fb7185" transparent opacity={0.85} />
      </lineSegments>
    </>
  );
}

/** Distance-based LOD: only label the nearest MAX_LABELS nodes to the camera. */
function Labels({ nodes }: { nodes: Node3D[] }) {
  const { camera } = useThree();
  const [visible, setVisible] = useState<Node3D[]>([]);
  const frame = useRef(0);

  useFrame(() => {
    frame.current = (frame.current + 1) % 8;
    if (frame.current !== 0) return;
    const camPos = camera.position;
    const scored = nodes
      .map((n) => ({
        n,
        d: (n.x - camPos.x) ** 2 + (n.y - camPos.y) ** 2 + (n.z - camPos.z) ** 2,
      }))
      .sort((a, b) => a.d - b.d)
      .slice(0, MAX_LABELS)
      // hide labels that are very far away
      .filter((s) => s.d < 90 * 90)
      .map((s) => s.n);
    setVisible(scored);
  });

  return (
    <>
      {visible.map((n) => {
        const span = lifespan(n);
        return (
          <Billboard key={n.id} position={[n.x, n.y + NODE_RADIUS + 1.2, n.z]}>
            <Text fontSize={1.1} color="#0f172a" anchorX="center" anchorY="bottom" outlineWidth={0.04} outlineColor="#ffffff">
              {n.firstName} {n.lastName}
            </Text>
            {span ? (
              <Text position={[0, -1.2, 0]} fontSize={0.75} color="#475569" anchorX="center" anchorY="bottom">
                {span}
              </Text>
            ) : null}
          </Billboard>
        );
      })}
    </>
  );
}

function CameraRig({
  focusNode,
  controlsRef,
}: {
  focusNode?: Node3D;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const target = useRef(new THREE.Vector3());
  const active = useRef(false);

  useEffect(() => {
    if (focusNode) {
      target.current.set(focusNode.x, focusNode.y, focusNode.z);
      active.current = true;
    }
  }, [focusNode]);

  useFrame((state) => {
    if (!active.current || !controlsRef.current) return;
    const controls = controlsRef.current;
    controls.target.lerp(target.current, 0.1);
    const desired = new THREE.Vector3(
      target.current.x,
      target.current.y + 6,
      target.current.z + 22,
    );
    state.camera.position.lerp(desired, 0.1);
    controls.update();
    if (state.camera.position.distanceTo(desired) < 0.4) active.current = false;
  });

  return null;
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

  const nodeById = useMemo(
    () => new Map(data.nodes.map((n) => [n.id, n])),
    [data.nodes],
  );

  useEffect(() => {
    if (focusId) {
      setSelectedId(focusId);
      setFocusNodeId(focusId);
    }
  }, [focusId]);

  const selectedNode = selectedId ? nodeById.get(selectedId) : undefined;
  const focusNode = focusNodeId ? nodeById.get(focusNodeId) : undefined;

  return (
    <div className="relative h-full w-full bg-slate-900">
      <Canvas camera={{ position: [0, 10, 60], fov: 55 }} dpr={[1, 2]}>
        <color attach="background" args={["#0f172a"]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[20, 30, 20]} intensity={1.1} />
        <directionalLight position={[-20, -10, -20]} intensity={0.4} />

        <Nodes
          nodes={data.nodes}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onFocus={(id) => {
            setSelectedId(id);
            setFocusNodeId(id);
          }}
        />
        <SelectionRing node={selectedNode} />
        <Edges data={data} nodeById={nodeById} />
        <Labels nodes={data.nodes} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.1}
          maxDistance={400}
          minDistance={6}
        />
        <CameraRig focusNode={focusNode} controlsRef={controlsRef} />
      </Canvas>

      {/* Selected person panel */}
      {selectedNode ? (
        <div className="absolute left-3 top-3 w-60 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="font-semibold">
            {selectedNode.firstName} {selectedNode.lastName}
          </div>
          {lifespan(selectedNode) ? (
            <div className="text-sm text-muted-foreground">
              {lifespan(selectedNode)}
            </div>
          ) : null}
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFocusNodeId(selectedNode.id)}
            >
              Focus
            </Button>
            <Button
              size="sm"
              onClick={() =>
                router.push(`/tree/${treeId}/people?person=${selectedNode.id}`)
              }
            >
              Open profile
            </Button>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur">
        Drag to orbit · scroll to zoom · click a node to select · double-click to focus
      </div>
    </div>
  );
}
