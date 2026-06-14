import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "demo@roots.test";
  const passwordHash = await bcrypt.hash("demo12345", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo User", passwordHash },
  });

  // Fresh demo tree each run.
  await prisma.tree.deleteMany({
    where: { ownerId: user.id, name: "The Doe Family (demo)" },
  });
  const tree = await prisma.tree.create({
    data: {
      name: "The Doe Family (demo)",
      description: "Sample tree seeded for testing relationships and views.",
      ownerId: user.id,
    },
  });

  const mkPerson = (
    firstName: string,
    lastName: string,
    gender: "MALE" | "FEMALE",
    birthDate?: string,
    deathDate?: string,
  ) =>
    prisma.person.create({
      data: { treeId: tree.id, firstName, lastName, gender, birthDate, deathDate },
    });

  // Generation 0
  const robert = await mkPerson("Robert", "Doe", "MALE", "1930", "2010");
  const margaret = await mkPerson("Margaret", "Doe", "FEMALE", "1932", "2015");

  // Generation 1 (children of Robert + Margaret)
  const john = await mkPerson("John", "Doe", "MALE", "1955");
  const susan = await mkPerson("Susan", "Doe", "FEMALE", "1958");
  const mary = await mkPerson("Mary", "Jones", "FEMALE", "1957"); // John's wife
  const david = await mkPerson("David", "Smith", "MALE", "1956"); // Susan's husband

  // Generation 2 (children of John + Mary)
  const sarah = await mkPerson("Sarah", "Doe", "FEMALE", "1980");
  const michael = await mkPerson("Michael", "Doe", "MALE", "1983");
  const tom = await mkPerson("Tom", "Doe", "MALE", "1986");

  // Family 1: Robert + Margaret → John, Susan
  const fam1 = await prisma.family.create({
    data: {
      treeId: tree.id,
      partner1Id: robert.id,
      partner2Id: margaret.id,
      relationshipType: "MARRIED",
      marriageDate: "1953",
    },
  });
  await prisma.childInFamily.createMany({
    data: [
      { familyId: fam1.id, childId: john.id },
      { familyId: fam1.id, childId: susan.id },
    ],
  });

  // Family 2: John + Mary → Sarah, Michael, Tom
  const fam2 = await prisma.family.create({
    data: {
      treeId: tree.id,
      partner1Id: john.id,
      partner2Id: mary.id,
      relationshipType: "MARRIED",
      marriageDate: "1979",
    },
  });
  await prisma.childInFamily.createMany({
    data: [
      { familyId: fam2.id, childId: sarah.id },
      { familyId: fam2.id, childId: michael.id },
      { familyId: fam2.id, childId: tom.id },
    ],
  });

  // Family 3: Susan + David
  await prisma.family.create({
    data: {
      treeId: tree.id,
      partner1Id: susan.id,
      partner2Id: david.id,
      relationshipType: "MARRIED",
      marriageDate: "1981",
    },
  });

  console.log(`Seeded user ${email} (password: demo12345)`);
  console.log(`Tree "${tree.name}" with 9 people, 3 families.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
