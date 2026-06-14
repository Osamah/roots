import {
  parseGedcom,
  child,
  children,
  tagValue,
  type GedcomNode,
} from "./parse";

export interface MappedPerson {
  gedcomId: string;
  firstName: string;
  lastName: string;
  middleNames?: string;
  nickname?: string;
  gender: "MALE" | "FEMALE" | "UNKNOWN";
  birthDate?: string;
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  occupation?: string;
  notes?: string;
}

export interface MappedFamily {
  gedcomId: string;
  partner1?: string; // gedcom person xref
  partner2?: string;
  children: string[]; // gedcom person xrefs
  relationshipType: "MARRIED" | "PARTNER" | "UNKNOWN";
  marriageDate?: string;
  marriagePlace?: string;
}

export interface MappedSource {
  gedcomId: string;
  title?: string;
  text?: string;
}
export interface MappedNote {
  gedcomId: string;
  text?: string;
}
export interface MappedMedia {
  url: string;
  caption?: string;
}

export interface GedcomMapResult {
  individuals: MappedPerson[];
  families: MappedFamily[];
  sources: MappedSource[];
  notes: MappedNote[];
  media: MappedMedia[];
  warnings: string[];
  unsupportedTags: string[];
}

const KNOWN_TOP = new Set([
  "HEAD",
  "TRLR",
  "SUBM",
  "INDI",
  "FAM",
  "SOUR",
  "NOTE",
  "OBJE",
  "REPO",
]);

function parseName(node: GedcomNode): {
  first: string;
  last: string;
  middle?: string;
  nick?: string;
} {
  const name = child(node, "NAME");
  // Prefer structured GIVN/SURN if present.
  const givn = name ? child(name, "GIVN")?.value : undefined;
  const surn = name ? child(name, "SURN")?.value : undefined;
  const nick = name ? child(name, "NICK")?.value : undefined;

  let first = "";
  let last = "";
  if (givn || surn) {
    first = givn ?? "";
    last = surn ?? "";
  } else if (name?.value) {
    // "John Allen /Smith/" → given "John Allen", surname "Smith"
    const match = name.value.match(/^(.*?)\/(.*?)\//);
    if (match) {
      first = match[1].trim();
      last = match[2].trim();
    } else {
      first = name.value.trim();
    }
  }

  // Split off middle names from the given part.
  const parts = first.split(/\s+/).filter(Boolean);
  const result = {
    first: parts[0] ?? "Unknown",
    last: last || "",
    middle: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
    nick,
  };
  return result;
}

function mapSex(node: GedcomNode): MappedPerson["gender"] {
  const s = child(node, "SEX")?.value?.toUpperCase();
  if (s === "M") return "MALE";
  if (s === "F") return "FEMALE";
  return "UNKNOWN";
}

function collectNotes(node: GedcomNode): string | undefined {
  const notes = children(node, "NOTE")
    .map((n) => n.value)
    .filter(Boolean);
  return notes.length ? notes.join("\n\n") : undefined;
}

export function mapGedcom(input: string): GedcomMapResult {
  const roots = parseGedcom(input);
  const individuals: MappedPerson[] = [];
  const families: MappedFamily[] = [];
  const sources: MappedSource[] = [];
  const notes: MappedNote[] = [];
  const media: MappedMedia[] = [];
  const warnings: string[] = [];
  const unsupported = new Set<string>();

  for (const node of roots) {
    switch (node.tag) {
      case "INDI": {
        if (!node.xref) {
          warnings.push("Skipped an INDI record with no id.");
          break;
        }
        const name = parseName(node);
        individuals.push({
          gedcomId: node.xref,
          firstName: name.first,
          lastName: name.last,
          middleNames: name.middle,
          nickname: name.nick,
          gender: mapSex(node),
          birthDate: tagValue(node, "BIRT", "DATE"),
          birthPlace: tagValue(node, "BIRT", "PLAC"),
          deathDate: tagValue(node, "DEAT", "DATE"),
          deathPlace: tagValue(node, "DEAT", "PLAC"),
          occupation: child(node, "OCCU")?.value,
          notes: collectNotes(node),
        });
        break;
      }
      case "FAM": {
        if (!node.xref) {
          warnings.push("Skipped a FAM record with no id.");
          break;
        }
        const husb = child(node, "HUSB")?.pointer;
        const wife = child(node, "WIFE")?.pointer;
        const kids = children(node, "CHIL")
          .map((c) => c.pointer)
          .filter((p): p is string => !!p);
        const marr = child(node, "MARR");
        families.push({
          gedcomId: node.xref,
          partner1: husb,
          partner2: wife,
          children: kids,
          relationshipType: marr ? "MARRIED" : "UNKNOWN",
          marriageDate: marr ? child(marr, "DATE")?.value : undefined,
          marriagePlace: marr ? child(marr, "PLAC")?.value : undefined,
        });
        break;
      }
      case "SOUR": {
        if (!node.xref) break;
        sources.push({
          gedcomId: node.xref,
          title: child(node, "TITL")?.value,
          text: child(node, "TEXT")?.value,
        });
        break;
      }
      case "NOTE": {
        if (!node.xref) break;
        notes.push({ gedcomId: node.xref, text: node.value });
        break;
      }
      case "OBJE": {
        const file = child(node, "FILE");
        if (file?.value) {
          media.push({ url: file.value, caption: child(node, "TITL")?.value });
        }
        break;
      }
      default:
        if (!KNOWN_TOP.has(node.tag)) unsupported.add(node.tag);
    }
  }

  // Integrity warnings: family pointers to unknown individuals.
  const indiIds = new Set(individuals.map((i) => i.gedcomId));
  for (const fam of families) {
    for (const ref of [fam.partner1, fam.partner2, ...fam.children]) {
      if (ref && !indiIds.has(ref)) {
        warnings.push(`Family ${fam.gedcomId} references unknown person ${ref}.`);
      }
    }
  }

  return {
    individuals,
    families,
    sources,
    notes,
    media,
    warnings,
    unsupportedTags: [...unsupported],
  };
}
