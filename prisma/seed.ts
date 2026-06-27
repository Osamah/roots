import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// House Stark of Winterfell — A Song of Ice and Fire / Game of Thrones.
// Dates use the in-world "AC" (After Aegon's Conquest) calendar; the story's
// "present" runs ~298–303 AC. Houses are joined to the Starks by marriage:
// Tully, Arryn, Targaryen, Baratheon, Lannister, Tyrell, Bolton, Frey, Maegyr.
// ---------------------------------------------------------------------------

async function main() {
  const email = "demo@roots.test";
  const passwordHash = await bcrypt.hash("demo12345", 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Demo User", passwordHash },
  });

  // Fresh tree each run.
  await prisma.tree.deleteMany({
    where: { ownerId: user.id, name: "House Stark of Winterfell" },
  });
  const tree = await prisma.tree.create({
    data: {
      name: "House Stark of Winterfell",
      description:
        "The lords of Winterfell and the houses bound to them by marriage — Tully, Arryn, Targaryen, Baratheon, Lannister, Tyrell and Bolton. From A Song of Ice and Fire.",
      ownerId: user.id,
    },
  });

  type G = "MALE" | "FEMALE";
  interface PInput {
    first: string;
    last: string;
    gender: G;
    born?: string;
    died?: string;
    bornAt?: string;
    diedAt?: string;
    title?: string;
    nick?: string;
    bio?: string;
  }
  const mk = (p: PInput) =>
    prisma.person.create({
      data: {
        treeId: tree.id,
        firstName: p.first,
        lastName: p.last,
        gender: p.gender,
        birthDate: p.born,
        deathDate: p.died,
        birthPlace: p.bornAt,
        deathPlace: p.diedAt,
        occupation: p.title,
        nickname: p.nick,
        biography: p.bio,
      },
    });

  const union = (
    partner1: { id: string } | null,
    partner2: { id: string } | null,
    opts: {
      date?: string;
      place?: string;
      children?: { id: string }[];
      type?: "MARRIED" | "PARTNER";
    } = {},
  ) =>
    prisma.family.create({
      data: {
        treeId: tree.id,
        partner1Id: partner1?.id ?? null,
        partner2Id: partner2?.id ?? null,
        relationshipType: opts.type ?? "MARRIED",
        marriageDate: opts.date,
        marriagePlace: opts.place,
        children: opts.children?.length
          ? { create: opts.children.map((c) => ({ child: { connect: { id: c.id } } })) }
          : undefined,
      },
    });

  // === House Stark ========================================================
  const rickard = await mk({
    first: "Rickard", last: "Stark", gender: "MALE",
    died: "282 AC", bornAt: "Winterfell", diedAt: "King's Landing",
    title: "Lord of Winterfell, Warden of the North",
    bio: "Burned alive in the throne room by Aerys II Targaryen.",
  });
  const lyarra = await mk({
    first: "Lyarra", last: "Stark", gender: "FEMALE",
    title: "Lady of Winterfell",
    bio: "Born a Stark; wed her cousin Rickard, Lord of Winterfell.",
  });
  const brandon = await mk({
    first: "Brandon", last: "Stark", gender: "MALE",
    born: "c. 262 AC", died: "282 AC", diedAt: "King's Landing", nick: "The Wild Wolf",
    title: "Heir to Winterfell",
    bio: "Betrothed to Catelyn Tully; strangled before his father while trying to save him.",
  });
  const ned = await mk({
    first: "Eddard", last: "Stark", gender: "MALE", nick: "Ned",
    born: "263 AC", died: "299 AC", bornAt: "Winterfell", diedAt: "King's Landing",
    title: "Lord of Winterfell, Warden of the North, Hand of the King",
    bio: "Beheaded on the order of King Joffrey for alleged treason.",
  });
  const lyanna = await mk({
    first: "Lyanna", last: "Stark", gender: "FEMALE",
    born: "c. 267 AC", died: "283 AC", bornAt: "Winterfell", diedAt: "the Tower of Joy, Dorne",
    bio: "Betrothed to Robert Baratheon; mother of Jon Snow. Died soon after giving birth.",
  });
  const benjen = await mk({
    first: "Benjen", last: "Stark", gender: "MALE",
    born: "c. 267 AC", title: "First Ranger of the Night's Watch",
  });

  const catelyn = await mk({
    first: "Catelyn", last: "Tully", gender: "FEMALE",
    born: "c. 264 AC", died: "299 AC", bornAt: "Riverrun", diedAt: "the Twins",
    title: "Lady of Winterfell",
    bio: "Daughter of Lord Hoster Tully. Murdered at the Red Wedding.",
  });

  const robb = await mk({
    first: "Robb", last: "Stark", gender: "MALE", nick: "The Young Wolf",
    born: "283 AC", died: "299 AC", bornAt: "Winterfell", diedAt: "the Twins",
    title: "King in the North",
    bio: "Proclaimed King in the North; murdered at the Red Wedding.",
  });
  const sansa = await mk({
    first: "Sansa", last: "Stark", gender: "FEMALE",
    born: "286 AC", bornAt: "Winterfell",
    title: "Lady of Winterfell, Queen in the North",
    bio: "Wed to Tyrion Lannister and later Ramsay Bolton before ruling the North.",
  });
  const arya = await mk({
    first: "Arya", last: "Stark", gender: "FEMALE", nick: "Arya Underfoot",
    born: "289 AC", bornAt: "Winterfell",
    bio: "Trained by the Faceless Men of Braavos.",
  });
  const bran = await mk({
    first: "Brandon", last: "Stark", gender: "MALE", nick: "Bran",
    born: "290 AC", bornAt: "Winterfell",
    title: "The Three-Eyed Raven, King of the Six Kingdoms",
  });
  const rickon = await mk({
    first: "Rickon", last: "Stark", gender: "MALE",
    born: "293 AC", died: "303 AC", bornAt: "Winterfell", diedAt: "Winterfell",
    bio: "Killed by Ramsay Bolton before the Battle of the Bastards.",
  });
  const jon = await mk({
    first: "Jon", last: "Snow", gender: "MALE",
    born: "283 AC", diedAt: undefined,
    title: "Lord Commander of the Night's Watch, King in the North",
    bio: "Raised as Eddard Stark's natural son; in truth the trueborn son of Rhaegar Targaryen and Lyanna Stark, named Aegon Targaryen.",
  });

  // === House Tully (Riverrun) =============================================
  const hoster = await mk({
    first: "Hoster", last: "Tully", gender: "MALE",
    died: "299 AC", bornAt: "Riverrun", diedAt: "Riverrun",
    title: "Lord of Riverrun",
  });
  const minisa = await mk({
    first: "Minisa", last: "Whent", gender: "FEMALE",
    born: "c. 249 AC", died: "c. 270 AC", title: "Lady of Riverrun",
    bio: "Died in childbed.",
  });
  const lysa = await mk({
    first: "Lysa", last: "Tully", gender: "FEMALE",
    born: "c. 266 AC", died: "300 AC", bornAt: "Riverrun", diedAt: "the Eyrie",
    title: "Lady of the Eyrie",
    bio: "Pushed through the Moon Door by Petyr Baelish.",
  });
  const edmure = await mk({
    first: "Edmure", last: "Tully", gender: "MALE",
    born: "c. 269 AC", bornAt: "Riverrun", title: "Lord of Riverrun",
  });
  const roslin = await mk({
    first: "Roslin", last: "Frey", gender: "FEMALE",
    born: "c. 280 AC", bornAt: "the Twins",
    bio: "Of House Frey; wed Edmure Tully at the Red Wedding.",
  });

  // === House Arryn (the Eyrie) ============================================
  const jonArryn = await mk({
    first: "Jon", last: "Arryn", gender: "MALE",
    born: "219 AC", died: "298 AC", bornAt: "the Eyrie", diedAt: "King's Landing",
    title: "Lord of the Eyrie, Defender of the Vale, Hand of the King",
    bio: "Poisoned by his wife Lysa at the urging of Petyr Baelish.",
  });
  const robin = await mk({
    first: "Robert", last: "Arryn", gender: "MALE", nick: "Sweetrobin",
    born: "290 AC", bornAt: "the Eyrie", title: "Lord of the Eyrie",
  });

  // === House Targaryen ====================================================
  const aerys = await mk({
    first: "Aerys", last: "Targaryen", gender: "MALE", nick: "The Mad King",
    born: "244 AC", died: "283 AC", diedAt: "King's Landing",
    title: "Aerys II, King of the Andals and the First Men",
    bio: "Slain by Jaime Lannister during the Sack of King's Landing.",
  });
  const rhaella = await mk({
    first: "Rhaella", last: "Targaryen", gender: "FEMALE",
    born: "c. 246 AC", died: "284 AC", diedAt: "Dragonstone", title: "Queen",
    bio: "Sister and wife of Aerys II; died giving birth to Daenerys.",
  });
  const rhaegar = await mk({
    first: "Rhaegar", last: "Targaryen", gender: "MALE",
    born: "259 AC", died: "283 AC", diedAt: "the Trident",
    title: "Prince of Dragonstone",
    bio: "Heir to the Iron Throne; slain by Robert Baratheon at the Battle of the Trident.",
  });
  const viserys = await mk({
    first: "Viserys", last: "Targaryen", gender: "MALE", nick: "The Beggar King",
    born: "276 AC", died: "298 AC", diedAt: "Vaes Dothrak",
    bio: "Killed by Khal Drogo with a crown of molten gold.",
  });
  const daenerys = await mk({
    first: "Daenerys", last: "Targaryen", gender: "FEMALE", nick: "Khaleesi / Mother of Dragons",
    born: "284 AC", bornAt: "Dragonstone",
    title: "Queen of the Andals, the Rhoynar and the First Men",
  });
  const elia = await mk({
    first: "Elia", last: "Martell", gender: "FEMALE",
    born: "c. 257 AC", died: "283 AC", diedAt: "King's Landing",
    title: "Princess of Dorne",
    bio: "First wife of Rhaegar; murdered during the Sack of King's Landing.",
  });
  const rhaenys = await mk({
    first: "Rhaenys", last: "Targaryen", gender: "FEMALE",
    born: "c. 280 AC", died: "283 AC", diedAt: "King's Landing",
    bio: "Daughter of Rhaegar and Elia; killed during the Sack of King's Landing.",
  });
  const aegonElder = await mk({
    first: "Aegon", last: "Targaryen", gender: "MALE",
    born: "c. 281 AC", died: "283 AC", diedAt: "King's Landing",
    bio: "Infant son of Rhaegar and Elia; killed during the Sack of King's Landing. (Not to be confused with Jon Snow, also born Aegon.)",
  });
  const drogo = await mk({
    first: "Drogo", last: "", gender: "MALE", nick: "Khal",
    died: "298 AC", title: "Khal of the Dothraki",
    bio: "Dothraki warlord and first husband of Daenerys Targaryen.",
  });

  // === House Baratheon ====================================================
  const robert = await mk({
    first: "Robert", last: "Baratheon", gender: "MALE", nick: "The Usurper",
    born: "262 AC", died: "298 AC", bornAt: "Storm's End", diedAt: "King's Landing",
    title: "King of the Andals and the First Men",
    bio: "Betrothed to Lyanna Stark; took the throne after Robert's Rebellion. Died of a wound from a boar hunt.",
  });
  const stannis = await mk({
    first: "Stannis", last: "Baratheon", gender: "MALE",
    born: "264 AC", died: "299 AC", bornAt: "Storm's End",
    title: "Lord of Dragonstone",
    bio: "Claimed the Iron Throne after Robert's death.",
  });
  const renly = await mk({
    first: "Renly", last: "Baratheon", gender: "MALE",
    born: "277 AC", died: "299 AC", bornAt: "Storm's End",
    title: "Lord of Storm's End",
    bio: "Crowned himself king; slain by a shadow conjured by Melisandre.",
  });
  const selyse = await mk({
    first: "Selyse", last: "Florent", gender: "FEMALE",
    born: "c. 266 AC", died: "303 AC", title: "Lady of Dragonstone",
  });
  const shireen = await mk({
    first: "Shireen", last: "Baratheon", gender: "FEMALE",
    born: "289 AC", died: "303 AC", bornAt: "Dragonstone",
    bio: "Burned as a sacrifice to the Lord of Light.",
  });
  const joffrey = await mk({
    first: "Joffrey", last: "Baratheon", gender: "MALE",
    born: "286 AC", died: "300 AC", bornAt: "King's Landing", diedAt: "King's Landing",
    title: "King of the Andals and the First Men",
    bio: "Publicly Robert Baratheon's heir; in truth fathered by Jaime Lannister. Poisoned at his wedding feast.",
  });
  const myrcella = await mk({
    first: "Myrcella", last: "Baratheon", gender: "FEMALE",
    born: "290 AC", died: "300 AC", bornAt: "King's Landing", diedAt: "aboard ship off Dorne",
    bio: "Publicly Robert's daughter; in truth fathered by Jaime Lannister. Poisoned by Ellaria Sand.",
  });
  const tommen = await mk({
    first: "Tommen", last: "Baratheon", gender: "MALE",
    born: "291 AC", died: "300 AC", bornAt: "King's Landing", diedAt: "King's Landing",
    title: "King of the Andals and the First Men",
    bio: "Publicly Robert's son; in truth fathered by Jaime Lannister. Took his own life.",
  });

  // === House Lannister ====================================================
  const tywin = await mk({
    first: "Tywin", last: "Lannister", gender: "MALE",
    born: "242 AC", died: "300 AC", bornAt: "Casterly Rock", diedAt: "King's Landing",
    title: "Lord of Casterly Rock, Warden of the West, Hand of the King",
    bio: "Killed by his son Tyrion with a crossbow.",
  });
  const joanna = await mk({
    first: "Joanna", last: "Lannister", gender: "FEMALE",
    born: "c. 245 AC", died: "273 AC",
    bio: "Cousin and wife of Tywin; died giving birth to Tyrion.",
  });
  const cersei = await mk({
    first: "Cersei", last: "Lannister", gender: "FEMALE",
    born: "266 AC", died: "300 AC", bornAt: "Casterly Rock", diedAt: "King's Landing",
    title: "Queen of the Seven Kingdoms",
  });
  const jaime = await mk({
    first: "Jaime", last: "Lannister", gender: "MALE", nick: "The Kingslayer",
    born: "266 AC", died: "300 AC", bornAt: "Casterly Rock",
    title: "Lord Commander of the Kingsguard",
  });
  const tyrion = await mk({
    first: "Tyrion", last: "Lannister", gender: "MALE", nick: "The Imp",
    born: "273 AC", bornAt: "Casterly Rock",
    title: "Hand of the Queen",
  });

  // === House Tyrell =======================================================
  const margaery = await mk({
    first: "Margaery", last: "Tyrell", gender: "FEMALE",
    born: "c. 283 AC", died: "300 AC", bornAt: "Highgarden", diedAt: "King's Landing",
    title: "Queen",
    bio: "Wed in turn to Renly, Joffrey and Tommen. Killed in the destruction of the Great Sept of Baelor.",
  });

  // === House Bolton =======================================================
  const roose = await mk({
    first: "Roose", last: "Bolton", gender: "MALE",
    died: "303 AC", bornAt: "the Dreadfort", diedAt: "Winterfell",
    title: "Lord of the Dreadfort, Warden of the North",
    bio: "Betrayed the Starks at the Red Wedding; murdered by his son Ramsay.",
  });
  const ramsay = await mk({
    first: "Ramsay", last: "Bolton", gender: "MALE",
    died: "303 AC", diedAt: "Winterfell", title: "Lord of Winterfell",
    bio: "Born Ramsay Snow and legitimized as a Bolton. Wed Sansa Stark; killed by his own hounds after the Battle of the Bastards.",
  });

  // === Robb's wife ========================================================
  const talisa = await mk({
    first: "Talisa", last: "Maegyr", gender: "FEMALE",
    died: "299 AC", bornAt: "Volantis", diedAt: "the Twins",
    bio: "A healer from Volantis; wed Robb Stark and, pregnant, was killed at the Red Wedding.",
  });

  // === Unions =============================================================
  // Stark line
  await union(rickard, lyarra, {
    place: "Winterfell",
    children: [brandon, ned, lyanna, benjen],
  });
  await union(ned, catelyn, {
    date: "283 AC", place: "Riverrun",
    children: [robb, sansa, arya, bran, rickon],
  });
  // R + L = J  (links Stark ⇄ Targaryen by blood)
  await union(rhaegar, lyanna, {
    date: "282 AC", place: "Dorne",
    children: [jon],
  });

  // Tully line (links Stark ⇄ Tully)
  await union(hoster, minisa, {
    place: "Riverrun",
    children: [catelyn, lysa, edmure],
  });
  // Arryn (links Tully ⇄ Arryn)
  await union(jonArryn, lysa, { date: "298 AC", children: [robin] });
  // Frey (links Tully ⇄ Frey)
  await union(edmure, roslin, { date: "299 AC", place: "the Twins" });

  // Targaryen line
  await union(aerys, rhaella, { children: [rhaegar, viserys, daenerys] });
  await union(rhaegar, elia, {
    date: "280 AC", children: [rhaenys, aegonElder],
  });
  await union(drogo, daenerys, { date: "298 AC", place: "Vaes Dothrak" });

  // Lannister line
  await union(tywin, joanna, { children: [cersei, jaime, tyrion] });

  // Baratheon line (links Stark/Tully ⇄ Baratheon ⇄ Lannister ⇄ Tyrell)
  await union(robert, cersei, {
    date: "284 AC", place: "King's Landing",
    children: [joffrey, myrcella, tommen],
  });
  await union(stannis, selyse, { children: [shireen] });
  await union(renly, margaery, { date: "299 AC", type: "MARRIED" });

  // Sansa's marriages (links Stark ⇄ Lannister and Stark ⇄ Bolton)
  await union(tyrion, sansa, { date: "299 AC", place: "King's Landing" });
  await union(ramsay, sansa, { date: "303 AC", place: "Winterfell" });

  // Bolton (Ramsay's parentage — mother unknown)
  await union(roose, null, { type: "PARTNER", children: [ramsay] });

  // Robb's marriage
  await union(robb, talisa, { date: "299 AC" });

  const people = await prisma.person.count({ where: { treeId: tree.id } });
  const families = await prisma.family.count({ where: { treeId: tree.id } });
  console.log(`Seeded user ${email} (password: demo12345)`);
  console.log(`Tree "${tree.name}" with ${people} people, ${families} families.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
