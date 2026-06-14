import Link from "next/link";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuickAddRelatives } from "./quick-add-relatives";
import { PersonFormDialog } from "./person-form-dialog";
import { DeletePersonButton } from "./delete-person-button";
import { lifespan, type GraphPerson } from "@/lib/graph";
import type { DerivedRelations } from "@/lib/relationships";
import type { Person } from "@/generated/prisma/client";

function initials(p: { firstName: string; lastName: string }) {
  return `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
}

function RelationGroup({
  treeId,
  title,
  people,
}: {
  treeId: string;
  title: string;
  people: GraphPerson[];
}) {
  if (people.length === 0) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {people.map((p) => {
          const span = lifespan(p);
          return (
            <Link
              key={p.id}
              href={`/tree/${treeId}/people?person=${p.id}`}
              scroll={false}
              className="rounded-full border bg-background px-3 py-1 text-sm transition-colors hover:border-primary hover:bg-muted"
            >
              {p.firstName} {p.lastName}
              {span ? (
                <span className="ml-1 text-xs text-muted-foreground">
                  ({span})
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export function PersonProfile({
  treeId,
  person,
  relations,
}: {
  treeId: string;
  person: Person;
  relations: DerivedRelations;
}) {
  const span = lifespan(person);

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-2xl space-y-6 p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">
              {initials(person)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-2xl font-bold">
              {person.firstName} {person.lastName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {span ? <span>{span}</span> : null}
              {person.nickname ? <Badge variant="secondary">“{person.nickname}”</Badge> : null}
              {person.occupation ? <span>· {person.occupation}</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <PersonFormDialog
              treeId={treeId}
              mode="edit"
              person={person}
              triggerVariant="ghost"
              triggerSize="icon"
              triggerLabel="Edit person"
            >
              <Pencil className="h-4 w-4" />
            </PersonFormDialog>
            <DeletePersonButton
              treeId={treeId}
              personId={person.id}
              name={`${person.firstName} ${person.lastName}`}
            />
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4">
          <h3 className="mb-3 text-sm font-semibold">Add a relative</h3>
          <QuickAddRelatives
            treeId={treeId}
            anchorId={person.id}
            anchorLastName={person.lastName}
          />
        </div>

        <div className="space-y-4">
          <RelationGroup treeId={treeId} title="Parents" people={relations.parents} />
          <RelationGroup treeId={treeId} title="Partners" people={relations.partners} />
          <RelationGroup treeId={treeId} title="Siblings" people={relations.siblings} />
          <RelationGroup treeId={treeId} title="Children" people={relations.children} />
        </div>

        <Separator />

        <dl className="grid grid-cols-2 gap-4">
          <Detail label="Born" value={person.birthDate} />
          <Detail label="Birth place" value={person.birthPlace} />
          <Detail label="Died" value={person.deathDate} />
          <Detail label="Death place" value={person.deathPlace} />
          <Detail label="Middle names" value={person.middleNames} />
        </dl>

        {person.biography ? (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Biography
            </h4>
            <p className="whitespace-pre-wrap text-sm">{person.biography}</p>
          </div>
        ) : null}
        {person.notes ? (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notes
            </h4>
            <p className="whitespace-pre-wrap text-sm">{person.notes}</p>
          </div>
        ) : null}
      </div>
    </ScrollArea>
  );
}
