"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "people", label: "People" },
  { key: "2d", label: "Tree" },
  { key: "3d", label: "3D" },
  { key: "timeline", label: "Timeline" },
  { key: "import", label: "Import" },
  { key: "export", label: "Export" },
  { key: "stats", label: "Stats" },
];

export function TreeNav({ treeId }: { treeId: string }) {
  const pathname = usePathname();
  const base = `/tree/${treeId}`;

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const href = `${base}/${tab.key}`;
        const active =
          pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
