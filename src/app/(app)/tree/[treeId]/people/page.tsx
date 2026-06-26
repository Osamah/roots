import { Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireTreeAccess } from "@/lib/session";
import { getDerivedRelations } from "@/lib/relationships";
import { PeopleList } from "@/components/person/people-list";
import { PersonProfile } from "@/components/person/person-profile";
import { PersonFormDialog } from "@/components/person/person-form-dialog";

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ treeId: string }>;
  searchParams: Promise<{ person?: string }>;
}) {
  const { treeId } = await params;
  const { person: selectedId } = await searchParams;
  await requireTreeAccess(treeId);

  const people = await prisma.person.findMany({
    where: { treeId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      gender: true,
      birthDate: true,
      deathDate: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const selected = selectedId
    ? await prisma.person.findFirst({ where: { id: selectedId, treeId } })
    : null;
  const relations = selected
    ? await getDerivedRelations(selected.id)
    : null;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[320px_1fr] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
      <aside className="flex min-h-0 flex-col border-r md:overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <span className="text-sm font-semibold">People</span>
          <PersonFormDialog treeId={treeId} mode="create" triggerSize="sm">
            <Plus className="mr-1 h-4 w-4" />
            Add
          </PersonFormDialog>
        </div>
        <div className="min-h-0 flex-1">
          <PeopleList treeId={treeId} people={people} selectedId={selectedId} />
        </div>
      </aside>

      <section className="min-h-0 md:overflow-hidden">
        {selected && relations ? (
          <PersonProfile treeId={treeId} person={selected} relations={relations} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="text-4xl">👋</span>
            <div>
              <p className="font-medium">
                {people.length === 0
                  ? "This tree is empty."
                  : "Select a person to view their profile."}
              </p>
              <p className="text-sm text-muted-foreground">
                {people.length === 0
                  ? "Add your first person to get started."
                  : "Or add a new person."}
              </p>
            </div>
            <PersonFormDialog treeId={treeId} mode="create">
              <Plus className="mr-1 h-4 w-4" />
              Add person
            </PersonFormDialog>
          </div>
        )}
      </section>
    </div>
  );
}
