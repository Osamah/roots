"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  exportAction,
  type ExportData,
} from "@/app/(app)/tree/[treeId]/export/actions";

export function GedcomExporter({ treeId }: { treeId: string }) {
  const [result, setResult] = useState<ExportData | null>(null);
  const [isPending, startTransition] = useTransition();

  function download(data: ExportData) {
    const blob = new Blob([data.gedcom], {
      type: "text/vnd.familysearch.gedcom;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = data.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function doExport() {
    startTransition(async () => {
      try {
        const data = await exportAction(treeId);
        setResult(data);
        download(data);
        toast.success(`Exported ${data.people} people`);
      } catch {
        toast.error("Export failed.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Export GEDCOM</h1>
        <p className="text-sm text-muted-foreground">
          Download this tree as a GEDCOM 5.5.1 file, compatible with WebTrees,
          Ancestry, and other genealogy tools. Original record IDs are
          preserved.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Download .ged file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="People" value={result.people} />
              <Stat label="Families" value={result.families} />
              <Stat label="Sources" value={result.sources} />
              <Stat label="Notes" value={result.notes} />
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={doExport} disabled={isPending}>
              <Download className="h-4 w-4" />
              {isPending
                ? "Preparing…"
                : result
                  ? "Download again"
                  : "Export tree"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
