import { prisma } from "@/lib/db";
import { mapGedcom, type GedcomMapResult } from "./map";

export interface ImportSummary {
  people: number;
  families: number;
  childLinks: number;
  sources: number;
  notes: number;
  warnings: string[];
  unsupportedTags: string[];
}

export function previewGedcom(text: string): GedcomMapResult {
  return mapGedcom(text);
}

/** Imports a parsed GEDCOM into a tree, preserving xref ids as gedcomId. */
export async function importGedcom(
  treeId: string,
  text: string,
): Promise<ImportSummary> {
  const mapped = mapGedcom(text);

  return prisma.$transaction(async (tx) => {
    // 1. People — keep gedcomId so we can resolve family pointers.
    const createdPeople = await tx.person.createManyAndReturn({
      data: mapped.individuals.map((p) => ({
        treeId,
        gedcomId: p.gedcomId,
        firstName: p.firstName || "Unknown",
        lastName: p.lastName ?? "",
        middleNames: p.middleNames ?? null,
        nickname: p.nickname ?? null,
        gender: p.gender,
        birthDate: p.birthDate ?? null,
        birthPlace: p.birthPlace ?? null,
        deathDate: p.deathDate ?? null,
        deathPlace: p.deathPlace ?? null,
        occupation: p.occupation ?? null,
        notes: p.notes ?? null,
      })),
      select: { id: true, gedcomId: true },
    });
    const personIdByXref = new Map(
      createdPeople.map((p) => [p.gedcomId!, p.id]),
    );

    // 2. Families — resolve partner pointers.
    const createdFamilies = await tx.family.createManyAndReturn({
      data: mapped.families.map((f) => ({
        treeId,
        gedcomId: f.gedcomId,
        partner1Id: f.partner1 ? personIdByXref.get(f.partner1) ?? null : null,
        partner2Id: f.partner2 ? personIdByXref.get(f.partner2) ?? null : null,
        relationshipType: f.relationshipType,
        marriageDate: f.marriageDate ?? null,
        marriagePlace: f.marriagePlace ?? null,
      })),
      select: { id: true, gedcomId: true },
    });
    const familyIdByXref = new Map(
      createdFamilies.map((f) => [f.gedcomId!, f.id]),
    );

    // 3. Child links.
    const childRows: { familyId: string; childId: string }[] = [];
    for (const fam of mapped.families) {
      const familyId = familyIdByXref.get(fam.gedcomId);
      if (!familyId) continue;
      for (const childXref of fam.children) {
        const childId = personIdByXref.get(childXref);
        if (childId) childRows.push({ familyId, childId });
      }
    }
    if (childRows.length) {
      await tx.childInFamily.createMany({ data: childRows, skipDuplicates: true });
    }

    // 4. Sources & notes.
    if (mapped.sources.length) {
      await tx.source.createMany({
        data: mapped.sources.map((s) => ({
          treeId,
          gedcomId: s.gedcomId,
          title: s.title ?? null,
          text: s.text ?? null,
        })),
      });
    }
    if (mapped.notes.length) {
      await tx.noteRecord.createMany({
        data: mapped.notes.map((n) => ({
          treeId,
          gedcomId: n.gedcomId,
          text: n.text ?? null,
        })),
      });
    }

    return {
      people: createdPeople.length,
      families: createdFamilies.length,
      childLinks: childRows.length,
      sources: mapped.sources.length,
      notes: mapped.notes.length,
      warnings: mapped.warnings,
      unsupportedTags: mapped.unsupportedTags,
    };
  });
}
