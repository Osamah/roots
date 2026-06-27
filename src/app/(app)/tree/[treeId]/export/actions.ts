"use server";

import { requireTreeAccess } from "@/lib/session";
import { exportGedcom, exportFileName } from "@/lib/gedcom/export";

export interface ExportData {
  fileName: string;
  gedcom: string;
  people: number;
  families: number;
  sources: number;
  notes: number;
}

export async function exportAction(treeId: string): Promise<ExportData> {
  const { tree } = await requireTreeAccess(treeId);
  const result = await exportGedcom(treeId);
  return {
    fileName: exportFileName(tree.name),
    gedcom: result.gedcom,
    people: result.people,
    families: result.families,
    sources: result.sources,
    notes: result.notes,
  };
}
