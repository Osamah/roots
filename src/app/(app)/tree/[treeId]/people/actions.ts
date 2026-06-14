"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireTreeAccess } from "@/lib/session";
import { personSchema, quickRelativeSchema } from "@/lib/validations";
import {
  addRelative,
  getDerivedRelations,
  linkRelative,
  type RelationKind,
} from "@/lib/relationships";
import type { Person } from "@/generated/prisma/client";

export type ActionResult =
  | { ok: true; personId: string }
  | { ok: false; error: string };

export type RelationChip = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  deathDate: string | null;
};

export interface ProfileData {
  person: Person;
  parents: RelationChip[];
  partners: RelationChip[];
  siblings: RelationChip[];
  children: RelationChip[];
}

const toChip = (p: {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  deathDate: string | null;
}): RelationChip => ({
  id: p.id,
  firstName: p.firstName,
  lastName: p.lastName,
  birthDate: p.birthDate,
  deathDate: p.deathDate,
});

/** Person + derived relations for the 2D profile popup. */
export async function getPersonProfileAction(
  treeId: string,
  personId: string,
): Promise<ProfileData | null> {
  await requireTreeAccess(treeId);
  const person = await prisma.person.findFirst({
    where: { id: personId, treeId },
  });
  if (!person) return null;
  const rel = await getDerivedRelations(personId);
  return {
    person,
    parents: rel.parents.map(toChip),
    partners: rel.partners.map(toChip),
    siblings: rel.siblings.map(toChip),
    children: rel.children.map(toChip),
  };
}

function fields(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  return get;
}

export async function createPersonAction(
  treeId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireTreeAccess(treeId);
  const get = fields(formData);
  const parsed = personSchema.safeParse({
    firstName: get("firstName"),
    lastName: get("lastName") ?? "",
    gender: get("gender") ?? "UNKNOWN",
    birthDate: get("birthDate"),
    deathDate: get("deathDate"),
    birthPlace: get("birthPlace"),
    deathPlace: get("deathPlace"),
    occupation: get("occupation"),
    biography: get("biography"),
    notes: get("notes"),
    middleNames: get("middleNames"),
    nickname: get("nickname"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const person = await prisma.person.create({
    data: { treeId, ...parsed.data },
  });
  revalidatePath(`/tree/${treeId}`, "layout");
  return { ok: true, personId: person.id };
}

export async function updatePersonAction(
  treeId: string,
  personId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireTreeAccess(treeId);
  const get = fields(formData);
  const parsed = personSchema.safeParse({
    firstName: get("firstName"),
    lastName: get("lastName") ?? "",
    gender: get("gender") ?? "UNKNOWN",
    birthDate: get("birthDate"),
    deathDate: get("deathDate"),
    birthPlace: get("birthPlace"),
    deathPlace: get("deathPlace"),
    occupation: get("occupation"),
    biography: get("biography"),
    notes: get("notes"),
    middleNames: get("middleNames"),
    nickname: get("nickname"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await prisma.person.updateMany({
    where: { id: personId, treeId },
    data: { ...parsed.data },
  });
  revalidatePath(`/tree/${treeId}`, "layout");
  return { ok: true, personId };
}

export async function deletePersonAction(treeId: string, personId: string) {
  await requireTreeAccess(treeId);
  await prisma.person.deleteMany({ where: { id: personId, treeId } });
  revalidatePath(`/tree/${treeId}`, "layout");
}

export async function addRelativeAction(
  treeId: string,
  anchorPersonId: string,
  formData: FormData,
): Promise<ActionResult> {
  await requireTreeAccess(treeId);
  const get = fields(formData);
  const parsed = quickRelativeSchema.safeParse({
    kind: get("kind"),
    firstName: get("firstName"),
    lastName: get("lastName") ?? "",
    gender: get("gender") ?? "UNKNOWN",
    birthDate: get("birthDate"),
    deathDate: get("deathDate"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const person = await addRelative(parsed.data.kind, treeId, anchorPersonId, {
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    gender: parsed.data.gender,
    birthDate: parsed.data.birthDate ?? null,
    deathDate: parsed.data.deathDate ?? null,
  });
  revalidatePath(`/tree/${treeId}`, "layout");
  return { ok: true, personId: person.id };
}

/** Link an existing person as a relative of the anchor. */
export async function linkRelativeAction(
  treeId: string,
  anchorPersonId: string,
  kind: RelationKind,
  relativeId: string,
): Promise<ActionResult> {
  await requireTreeAccess(treeId);
  const count = await prisma.person.count({
    where: { treeId, id: { in: [anchorPersonId, relativeId] } },
  });
  if (count !== 2 || anchorPersonId === relativeId) {
    return { ok: false, error: "Invalid person selection" };
  }
  await linkRelative(kind, treeId, anchorPersonId, relativeId);
  revalidatePath(`/tree/${treeId}`, "layout");
  return { ok: true, personId: relativeId };
}
