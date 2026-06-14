"use client";

import { useState } from "react";
import { UserPlus, Users, Heart, Baby } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuickRelativeDialog } from "./quick-relative-dialog";
import type { RelationKind } from "@/lib/relationships";

const KINDS: {
  kind: RelationKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { kind: "parent", label: "Parent", icon: UserPlus },
  { kind: "sibling", label: "Sibling", icon: Users },
  { kind: "partner", label: "Partner", icon: Heart },
  { kind: "child", label: "Child", icon: Baby },
];

export function QuickAddRelatives({
  treeId,
  anchorId,
  anchorLastName,
}: {
  treeId: string;
  anchorId: string;
  anchorLastName: string;
}) {
  const [openKind, setOpenKind] = useState<RelationKind | null>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {KINDS.map(({ kind, label, icon: Icon }) => (
          <Button
            key={kind}
            variant="outline"
            size="sm"
            onClick={() => setOpenKind(kind)}
          >
            <Icon className="mr-1 h-4 w-4" />
            {label}
          </Button>
        ))}
      </div>

      <QuickRelativeDialog
        treeId={treeId}
        anchorId={anchorId}
        anchorLastName={anchorLastName}
        kind={openKind}
        onOpenChange={(o) => !o && setOpenKind(null)}
      />
    </>
  );
}
