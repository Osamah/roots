"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  previewAction,
  importAction,
  type PreviewResult,
} from "@/app/(app)/tree/[treeId]/import/actions";
import type { ImportSummary } from "@/lib/gedcom/import";

type Stage = "idle" | "previewing" | "preview" | "importing" | "done";

export function GedcomUploader({ treeId }: { treeId: string }) {
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(file: File) {
    const content = await file.text();
    setText(content);
    setFileName(file.name);
    setStage("previewing");
    startTransition(async () => {
      try {
        const result = await previewAction(treeId, content);
        setPreview(result);
        setStage("preview");
      } catch {
        toast.error("Could not parse that file.");
        setStage("idle");
      }
    });
  }

  function doImport() {
    setStage("importing");
    startTransition(async () => {
      try {
        const result = await importAction(treeId, text);
        setSummary(result);
        setStage("done");
        toast.success(`Imported ${result.people} people`);
      } catch {
        toast.error("Import failed.");
        setStage("preview");
      }
    });
  }

  function reset() {
    setStage("idle");
    setPreview(null);
    setSummary(null);
    setText("");
    setFileName("");
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-6">
      <div>
        <h1 className="text-xl font-bold">Import GEDCOM / WebTrees</h1>
        <p className="text-sm text-muted-foreground">
          Upload a .ged file exported from WebTrees, Ancestry, or any genealogy
          tool. We preserve original record IDs.
        </p>
      </div>

      {stage === "idle" || stage === "previewing" ? (
        <Card>
          <CardContent className="py-10">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex w-full flex-col items-center gap-3 rounded-lg border-2 border-dashed py-10 transition-colors hover:border-primary hover:bg-muted/40"
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground" />
              <span className="font-medium">
                {stage === "previewing" ? "Reading file…" : "Choose a GEDCOM file"}
              </span>
              <span className="text-sm text-muted-foreground">.ged or .gedcom</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".ged,.gedcom,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      {stage === "preview" && preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview — {fileName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="People" value={preview.people} />
              <Stat label="Families" value={preview.families} />
              <Stat label="Sources" value={preview.sources} />
              <Stat label="Notes" value={preview.notes} />
            </div>

            {preview.sampleNames.length ? (
              <div>
                <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                  Sample
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.sampleNames.map((n, i) => (
                    <Badge key={i} variant="secondary">{n}</Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {preview.unsupportedTags.length ? (
              <p className="text-xs text-muted-foreground">
                Unsupported tags skipped: {preview.unsupportedTags.join(", ")}
              </p>
            ) : null}

            {preview.warnings.length ? (
              <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-medium">{preview.warnings.length} warning(s):</p>
                <ul className="ml-4 list-disc">
                  {preview.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button onClick={doImport} disabled={preview.people === 0}>
                Import {preview.people} people
              </Button>
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {stage === "importing" ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Importing…
          </CardContent>
        </Card>
      ) : null}

      {stage === "done" && summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Import complete 🎉</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="People" value={summary.people} />
              <Stat label="Families" value={summary.families} />
              <Stat label="Links" value={summary.childLinks} />
              <Stat label="Sources" value={summary.sources} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => router.push(`/tree/${treeId}/people`)}>
                View people
              </Button>
              <Button variant="outline" onClick={() => router.push(`/tree/${treeId}/3d`)}>
                Explore in 3D
              </Button>
              <Button variant="ghost" onClick={reset}>
                Import another
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
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
