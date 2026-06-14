// Minimal but robust GEDCOM tokenizer → hierarchical record tree.
// A GEDCOM line is: LEVEL [@XREF@] TAG [VALUE]

export interface GedcomNode {
  level: number;
  xref?: string; // without surrounding @
  tag: string;
  value?: string;
  pointer?: string; // if value is a @XREF@ pointer, the bare id
  children: GedcomNode[];
}

const LINE_RE = /^\s*(\d+)\s+(?:@([^@]+)@\s+)?(\S+)(?:\s(.*))?$/;

export function parseGedcom(input: string): GedcomNode[] {
  const text = input.replace(/^﻿/, ""); // strip BOM
  const lines = text.split(/\r\n|\r|\n/);

  const roots: GedcomNode[] = [];
  // stack[level] = current node at that level
  const stack: GedcomNode[] = [];

  for (const raw of lines) {
    if (!raw.trim()) continue;
    const m = LINE_RE.exec(raw);
    if (!m) continue;
    const level = parseInt(m[1], 10);
    const xref = m[2];
    const tag = m[3];
    let value: string | undefined = m[4]?.trim();

    // CONT/CONC are continuations of the parent's value.
    if ((tag === "CONT" || tag === "CONC") && stack[level - 1]) {
      const parent = stack[level - 1];
      const sep = tag === "CONT" ? "\n" : "";
      parent.value = (parent.value ?? "") + sep + (value ?? "");
      continue;
    }

    let pointer: string | undefined;
    if (value && /^@[^@]+@$/.test(value)) {
      pointer = value.slice(1, -1);
      value = undefined;
    }

    const node: GedcomNode = {
      level,
      xref,
      tag,
      value,
      pointer,
      children: [],
    };

    if (level === 0) {
      roots.push(node);
    } else if (stack[level - 1]) {
      stack[level - 1].children.push(node);
    }
    stack[level] = node;
    stack.length = level + 1; // drop deeper stale entries
  }

  return roots;
}

/** First direct child with the given tag. */
export function child(node: GedcomNode, tag: string): GedcomNode | undefined {
  return node.children.find((c) => c.tag === tag);
}

/** All direct children with the given tag. */
export function children(node: GedcomNode, tag: string): GedcomNode[] {
  return node.children.filter((c) => c.tag === tag);
}

/** Value of a child tag, optionally a nested sub-tag (e.g. BIRT → DATE). */
export function tagValue(
  node: GedcomNode,
  tag: string,
  subTag?: string,
): string | undefined {
  const c = child(node, tag);
  if (!c) return undefined;
  if (!subTag) return c.value;
  return child(c, subTag)?.value;
}
