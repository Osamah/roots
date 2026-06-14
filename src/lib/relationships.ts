import { prisma } from "@/lib/db";
import { type Person, Prisma } from "@/generated/prisma/client";
import { RelationshipType } from "@/generated/prisma/enums";

/** Minimal fields needed to spin up a new relative from the quick-add form. */
export type NewPersonInput = {
  firstName: string;
  lastName: string;
  gender?: "MALE" | "FEMALE" | "UNKNOWN";
  birthDate?: string | null;
  deathDate?: string | null;
};

export type RelationKind = "parent" | "child" | "sibling" | "partner";

function personCreateData(treeId: string, input: NewPersonInput) {
  return {
    treeId,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    gender: input.gender ?? "UNKNOWN",
    birthDate: input.birthDate?.trim() || null,
    deathDate: input.deathDate?.trim() || null,
  };
}

// ---------------------------------------------------------------------------
// Derivation — relationships are computed from Family / ChildInFamily, never
// stored as a dedicated edge.
// ---------------------------------------------------------------------------

export type DerivedRelations = {
  parents: Person[];
  children: Person[];
  siblings: Person[];
  partners: Person[];
};

export async function getDerivedRelations(
  personId: string,
): Promise<DerivedRelations> {
  // Families where this person is a child → parents & siblings.
  const childLinks = await prisma.childInFamily.findMany({
    where: { childId: personId },
    include: {
      family: {
        include: {
          partner1: true,
          partner2: true,
          children: { include: { child: true } },
        },
      },
    },
  });

  // Families where this person is a partner → children & partners.
  const partnerFamilies = await prisma.family.findMany({
    where: { OR: [{ partner1Id: personId }, { partner2Id: personId }] },
    include: {
      partner1: true,
      partner2: true,
      children: { include: { child: true } },
    },
  });

  const parentsMap = new Map<string, Person>();
  const siblingsMap = new Map<string, Person>();
  const childrenMap = new Map<string, Person>();
  const partnersMap = new Map<string, Person>();

  for (const link of childLinks) {
    const fam = link.family;
    for (const p of [fam.partner1, fam.partner2]) {
      if (p) parentsMap.set(p.id, p);
    }
    for (const c of fam.children) {
      if (c.childId !== personId) siblingsMap.set(c.childId, c.child);
    }
  }

  for (const fam of partnerFamilies) {
    const other = fam.partner1Id === personId ? fam.partner2 : fam.partner1;
    if (other) partnersMap.set(other.id, other);
    for (const c of fam.children) childrenMap.set(c.childId, c.child);
  }

  return {
    parents: [...parentsMap.values()],
    children: [...childrenMap.values()],
    siblings: [...siblingsMap.values()],
    partners: [...partnersMap.values()],
  };
}

// ---------------------------------------------------------------------------
// Mutations — each creates the new Person and wires the correct links atomically.
// Returns the newly created person.
// ---------------------------------------------------------------------------

export async function addParent(
  treeId: string,
  childId: string,
  input: NewPersonInput,
): Promise<Person> {
  return prisma.$transaction(async (tx) => {
    const parent = await tx.person.create({
      data: personCreateData(treeId, input),
    });

    // Reuse the family the child already belongs to, if any.
    const existing = await tx.childInFamily.findFirst({
      where: { childId },
      include: { family: true },
    });

    if (existing) {
      const fam = existing.family;
      if (!fam.partner1Id) {
        await tx.family.update({
          where: { id: fam.id },
          data: { partner1Id: parent.id },
        });
        return parent;
      }
      if (!fam.partner2Id) {
        await tx.family.update({
          where: { id: fam.id },
          data: { partner2Id: parent.id },
        });
        return parent;
      }
      // Both parent slots already filled → fall through to a new family.
    }

    const family = await tx.family.create({
      data: { treeId, partner1Id: parent.id },
    });
    await tx.childInFamily.create({
      data: { familyId: family.id, childId },
    });
    return parent;
  });
}

export async function addChild(
  treeId: string,
  parentId: string,
  input: NewPersonInput,
): Promise<Person> {
  return prisma.$transaction(async (tx) => {
    const child = await tx.person.create({
      data: personCreateData(treeId, input),
    });

    // Prefer an existing family where this parent is a partner.
    let family = await tx.family.findFirst({
      where: { OR: [{ partner1Id: parentId }, { partner2Id: parentId }] },
    });
    if (!family) {
      family = await tx.family.create({
        data: { treeId, partner1Id: parentId },
      });
    }

    await tx.childInFamily.create({
      data: { familyId: family.id, childId: child.id },
    });
    return child;
  });
}

export async function addSibling(
  treeId: string,
  personId: string,
  input: NewPersonInput,
): Promise<Person> {
  return prisma.$transaction(async (tx) => {
    const sibling = await tx.person.create({
      data: personCreateData(treeId, input),
    });

    // Attach to the same family the person is a child of.
    const existing = await tx.childInFamily.findFirst({
      where: { childId: personId },
    });

    let familyId = existing?.familyId;
    if (!familyId) {
      const family = await tx.family.create({ data: { treeId } });
      familyId = family.id;
      await tx.childInFamily.create({
        data: { familyId, childId: personId },
      });
    }

    await tx.childInFamily.create({
      data: { familyId, childId: sibling.id },
    });
    return sibling;
  });
}

export async function addPartner(
  treeId: string,
  personId: string,
  input: NewPersonInput,
): Promise<Person> {
  return prisma.$transaction(async (tx) => {
    const partner = await tx.person.create({
      data: personCreateData(treeId, input),
    });
    await tx.family.create({
      data: {
        treeId,
        partner1Id: personId,
        partner2Id: partner.id,
        relationshipType: RelationshipType.MARRIED,
      },
    });
    return partner;
  });
}

export async function addRelative(
  kind: RelationKind,
  treeId: string,
  anchorPersonId: string,
  input: NewPersonInput,
): Promise<Person> {
  switch (kind) {
    case "parent":
      return addParent(treeId, anchorPersonId, input);
    case "child":
      return addChild(treeId, anchorPersonId, input);
    case "sibling":
      return addSibling(treeId, anchorPersonId, input);
    case "partner":
      return addPartner(treeId, anchorPersonId, input);
  }
}

// ---------------------------------------------------------------------------
// Linking — attach an EXISTING person as a relative (no new person created).
// ---------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;

async function wireParent(tx: Tx, treeId: string, childId: string, parentId: string) {
  const existing = await tx.childInFamily.findFirst({
    where: { childId },
    include: { family: true },
  });
  if (existing) {
    const fam = existing.family;
    if (fam.partner1Id === parentId || fam.partner2Id === parentId) return;
    if (!fam.partner1Id) {
      await tx.family.update({ where: { id: fam.id }, data: { partner1Id: parentId } });
      return;
    }
    if (!fam.partner2Id) {
      await tx.family.update({ where: { id: fam.id }, data: { partner2Id: parentId } });
      return;
    }
  }
  const family = await tx.family.create({ data: { treeId, partner1Id: parentId } });
  await tx.childInFamily.createMany({
    data: [{ familyId: family.id, childId }],
    skipDuplicates: true,
  });
}

async function wireChild(tx: Tx, treeId: string, parentId: string, childId: string) {
  let family = await tx.family.findFirst({
    where: { OR: [{ partner1Id: parentId }, { partner2Id: parentId }] },
  });
  if (!family) family = await tx.family.create({ data: { treeId, partner1Id: parentId } });
  await tx.childInFamily.createMany({
    data: [{ familyId: family.id, childId }],
    skipDuplicates: true,
  });
}

async function wireSibling(tx: Tx, treeId: string, personId: string, siblingId: string) {
  const existing = await tx.childInFamily.findFirst({ where: { childId: personId } });
  let familyId = existing?.familyId;
  if (!familyId) {
    const family = await tx.family.create({ data: { treeId } });
    familyId = family.id;
    await tx.childInFamily.create({ data: { familyId, childId: personId } });
  }
  await tx.childInFamily.createMany({
    data: [{ familyId, childId: siblingId }],
    skipDuplicates: true,
  });
}

async function wirePartner(tx: Tx, treeId: string, personId: string, partnerId: string) {
  const fam = await tx.family.findFirst({
    where: {
      OR: [
        { partner1Id: personId, partner2Id: partnerId },
        { partner1Id: partnerId, partner2Id: personId },
      ],
    },
  });
  if (fam) return; // already partners
  await tx.family.create({
    data: {
      treeId,
      partner1Id: personId,
      partner2Id: partnerId,
      relationshipType: RelationshipType.MARRIED,
    },
  });
}

/** Link an existing person as a relative of the anchor (no creation). */
export async function linkRelative(
  kind: RelationKind,
  treeId: string,
  anchorPersonId: string,
  relativeId: string,
): Promise<void> {
  if (relativeId === anchorPersonId) return;
  await prisma.$transaction(async (tx) => {
    switch (kind) {
      case "parent":
        return wireParent(tx, treeId, anchorPersonId, relativeId);
      case "child":
        return wireChild(tx, treeId, anchorPersonId, relativeId);
      case "sibling":
        return wireSibling(tx, treeId, anchorPersonId, relativeId);
      case "partner":
        return wirePartner(tx, treeId, anchorPersonId, relativeId);
    }
  });
}
