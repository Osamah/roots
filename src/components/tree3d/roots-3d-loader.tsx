"use client";

import dynamic from "next/dynamic";
import type { Layout3DData } from "@/lib/layout3d";

// WebGL canvas is client-only — never SSR it.
const Roots3D = dynamic(
  () => import("./roots-3d").then((m) => m.Roots3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-900 text-sm text-slate-400">
        Loading 3D view…
      </div>
    ),
  },
);

export function Roots3DLoader(props: {
  treeId: string;
  data: Layout3DData;
  focusId?: string;
}) {
  return <Roots3D {...props} />;
}
