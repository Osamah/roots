"use server";

import { revalidatePath } from "next/cache";
import { requireTreeAccess } from "@/lib/session";
import { previewGedcom, importGedcom, type ImportSummary } from "@/lib/gedcom/import";

export interface PreviewResult {
  people: number;
  families: number;
  sources: number;
  notes: number;
  media: number;
  sampleNames: string[];
  warnings: string[];
  unsupportedTags: string[];
}

export async function previewAction(
  treeId: string,
  text: string,
): Promise<PreviewResult> {
  await requireTreeAccess(treeId);
  const m = previewGedcom(text);
  return {
    people: m.individuals.length,
    families: m.families.length,
    sources: m.sources.length,
    notes: m.notes.length,
    media: m.media.length,
    sampleNames: m.individuals
      .slice(0, 8)
      .map((p) => `${p.firstName} ${p.lastName}`.trim()),
    warnings: m.warnings.slice(0, 20),
    unsupportedTags: m.unsupportedTags,
  };
}

export async function importAction(
  treeId: string,
  text: string,
): Promise<ImportSummary> {
  await requireTreeAccess(treeId);
  const summary = await importGedcom(treeId, text);
  revalidatePath(`/tree/${treeId}`, "layout");
  return summary;
}
