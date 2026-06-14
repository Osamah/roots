import { prisma } from "@/lib/db";
import { requireTreeAccess } from "@/lib/session";
import {
  TimelineView,
  type TimelineEvent,
} from "@/components/timeline/timeline-view";

function year(date?: string | null): number | null {
  const m = (date ?? "").match(/\d{3,4}/);
  return m ? parseInt(m[0], 10) : null;
}

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  await requireTreeAccess(treeId);

  const [people, families] = await Promise.all([
    prisma.person.findMany({
      where: { treeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        birthPlace: true,
        deathDate: true,
        deathPlace: true,
      },
    }),
    prisma.family.findMany({
      where: { treeId, marriageDate: { not: null } },
      select: {
        marriageDate: true,
        marriagePlace: true,
        partner1: { select: { firstName: true, lastName: true } },
        partner2: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const events: TimelineEvent[] = [];
  for (const p of people) {
    const name = `${p.firstName} ${p.lastName}`.trim();
    const b = year(p.birthDate);
    if (b !== null)
      events.push({
        year: b,
        type: "birth",
        text: `${name} born`,
        detail: p.birthPlace ?? undefined,
        personId: p.id,
        treeId,
      });
    const d = year(p.deathDate);
    if (d !== null)
      events.push({
        year: d,
        type: "death",
        text: `${name} died`,
        detail: p.deathPlace ?? undefined,
        personId: p.id,
        treeId,
      });
  }
  for (const f of families) {
    const y = year(f.marriageDate);
    if (y === null) continue;
    const a = f.partner1 ? `${f.partner1.firstName} ${f.partner1.lastName}`.trim() : "?";
    const b = f.partner2 ? `${f.partner2.firstName} ${f.partner2.lastName}`.trim() : "?";
    events.push({
      year: y,
      type: "marriage",
      text: `${a} & ${b} married`,
      detail: f.marriagePlace ?? undefined,
      treeId,
    });
  }

  return <TimelineView events={events} />;
}
