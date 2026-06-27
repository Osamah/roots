import { prisma } from "@/lib/db";

export interface ExportResult {
  gedcom: string;
  people: number;
  families: number;
  sources: number;
  notes: number;
}

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

function gedcomDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * Assigns a stable GEDCOM xref to each record. Preserves the original
 * `gedcomId` where present and unique; generates `<prefix><n>` otherwise,
 * never colliding with a preserved id.
 */
function buildXrefMap(
  items: { id: string; gedcomId: string | null }[],
  prefix: string,
): Map<string, string> {
  const used = new Set<string>();
  const map = new Map<string, string>();

  for (const it of items) {
    const g = it.gedcomId?.trim();
    if (g && !used.has(g)) {
      used.add(g);
      map.set(it.id, g);
    }
  }

  let n = 0;
  for (const it of items) {
    if (map.has(it.id)) continue;
    let x: string;
    do {
      n++;
      x = `${prefix}${n}`;
    } while (used.has(x));
    used.add(x);
    map.set(it.id, x);
  }

  return map;
}

// Accumulates GEDCOM lines. CRLF-joined at the end per the 5.5.1 spec.
class GedcomBuilder {
  private lines: string[] = [];

  tag(level: number, tag: string, value?: string) {
    this.lines.push(value ? `${level} ${tag} ${value}` : `${level} ${tag}`);
  }

  record(xref: string, tag: string, value?: string) {
    this.lines.push(value ? `0 @${xref}@ ${tag} ${value}` : `0 @${xref}@ ${tag}`);
  }

  pointer(level: number, tag: string, xref: string) {
    this.lines.push(`${level} ${tag} @${xref}@`);
  }

  /** Emits a tag whose value may span multiple lines, using CONT. */
  text(level: number, tag: string, value: string) {
    const parts = value.split(/\r\n|\r|\n/);
    this.tag(level, tag, parts[0] ?? "");
    for (const p of parts.slice(1)) this.tag(level + 1, "CONT", p);
  }

  toString(): string {
    return this.lines.join("\r\n") + "\r\n";
  }
}

function nameValue(p: {
  firstName: string;
  middleNames: string | null;
  lastName: string;
}): string {
  const given = [p.firstName, p.middleNames].filter(Boolean).join(" ").trim();
  const surname = p.lastName?.trim() ?? "";
  if (surname) return `${given} /${surname}/`.trim();
  return given;
}

function sexValue(gender: string): string | undefined {
  if (gender === "MALE") return "M";
  if (gender === "FEMALE") return "F";
  return undefined;
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Serializes a tree to a GEDCOM 5.5.1 string, reversing the importer. */
export async function exportGedcom(treeId: string): Promise<ExportResult> {
  const [people, families, sources, notes] = await Promise.all([
    prisma.person.findMany({
      where: { treeId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.family.findMany({
      where: { treeId },
      include: { children: { orderBy: { id: "asc" } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.source.findMany({ where: { treeId }, orderBy: { id: "asc" } }),
    prisma.noteRecord.findMany({ where: { treeId }, orderBy: { id: "asc" } }),
  ]);

  const personXref = buildXrefMap(people, "I");
  const familyXref = buildXrefMap(families, "F");
  const sourceXref = buildXrefMap(sources, "S");
  const noteXref = buildXrefMap(notes, "N");

  // Reverse links: a person points to families they partner in (FAMS) or are
  // a child of (FAMC).
  const fams = new Map<string, string[]>();
  const famc = new Map<string, string[]>();
  for (const fam of families) {
    const fx = familyXref.get(fam.id)!;
    if (fam.partner1Id) push(fams, fam.partner1Id, fx);
    if (fam.partner2Id) push(fams, fam.partner2Id, fx);
    for (const link of fam.children) push(famc, link.childId, fx);
  }

  const b = new GedcomBuilder();

  // Header
  b.tag(0, "HEAD");
  b.tag(1, "SOUR", "Roots");
  b.tag(2, "NAME", "Roots");
  b.tag(1, "GEDC");
  b.tag(2, "VERS", "5.5.1");
  b.tag(2, "FORM", "LINEAGE-LINKED");
  b.tag(1, "CHAR", "UTF-8");
  b.tag(1, "DATE", gedcomDate(new Date()));

  // Individuals
  for (const p of people) {
    b.record(personXref.get(p.id)!, "INDI");
    b.text(1, "NAME", nameValue(p));
    const given = [p.firstName, p.middleNames].filter(Boolean).join(" ").trim();
    if (given) b.tag(2, "GIVN", given);
    if (p.lastName?.trim()) b.tag(2, "SURN", p.lastName.trim());
    if (p.nickname) b.tag(2, "NICK", p.nickname);

    const sex = sexValue(p.gender);
    if (sex) b.tag(1, "SEX", sex);

    if (p.birthDate || p.birthPlace) {
      b.tag(1, "BIRT");
      if (p.birthDate) b.tag(2, "DATE", p.birthDate);
      if (p.birthPlace) b.text(2, "PLAC", p.birthPlace);
    }
    if (p.deathDate || p.deathPlace) {
      b.tag(1, "DEAT");
      if (p.deathDate) b.tag(2, "DATE", p.deathDate);
      if (p.deathPlace) b.text(2, "PLAC", p.deathPlace);
    }

    if (p.occupation) b.text(1, "OCCU", p.occupation);
    if (p.notes) b.text(1, "NOTE", p.notes);
    if (p.biography) b.text(1, "NOTE", p.biography);

    for (const fx of fams.get(p.id) ?? []) b.pointer(1, "FAMS", fx);
    for (const fx of famc.get(p.id) ?? []) b.pointer(1, "FAMC", fx);
  }

  // Families
  for (const fam of families) {
    b.record(familyXref.get(fam.id)!, "FAM");
    if (fam.partner1Id) b.pointer(1, "HUSB", personXref.get(fam.partner1Id)!);
    if (fam.partner2Id) b.pointer(1, "WIFE", personXref.get(fam.partner2Id)!);
    for (const link of fam.children) {
      b.pointer(1, "CHIL", personXref.get(link.childId)!);
    }
    if (
      fam.relationshipType === "MARRIED" ||
      fam.marriageDate ||
      fam.marriagePlace
    ) {
      b.tag(1, "MARR");
      if (fam.marriageDate) b.tag(2, "DATE", fam.marriageDate);
      if (fam.marriagePlace) b.text(2, "PLAC", fam.marriagePlace);
    }
  }

  // Sources
  for (const s of sources) {
    b.record(sourceXref.get(s.id)!, "SOUR");
    if (s.title) b.text(1, "TITL", s.title);
    if (s.text) b.text(1, "TEXT", s.text);
  }

  // Notes — first line rides on the record line, the rest as CONT.
  for (const n of notes) {
    const parts = (n.text ?? "").split(/\r\n|\r|\n/);
    b.record(noteXref.get(n.id)!, "NOTE", parts[0] || undefined);
    for (const p of parts.slice(1)) b.tag(1, "CONT", p);
  }

  b.tag(0, "TRLR");

  return {
    gedcom: b.toString(),
    people: people.length,
    families: families.length,
    sources: sources.length,
    notes: notes.length,
  };
}

/** A filesystem-safe `.ged` filename derived from the tree name. */
export function exportFileName(treeName: string | undefined): string {
  const slug = (treeName ?? "tree")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "tree"}.ged`;
}
