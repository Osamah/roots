"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Users, Heart, Baby, ExternalLink, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuickRelativeDialog } from "./quick-relative-dialog";
import { lifespan } from "@/lib/graph";
import type { RelationKind } from "@/lib/relationships";
import {
  getPersonProfileAction,
  type ProfileData,
  type RelationChip,
} from "@/app/(app)/tree/[treeId]/people/actions";

// Mirror the "Add a relative" section: same icons, labels, and order.
const KINDS: {
  kind: RelationKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { kind: "parent", label: "Parent", icon: UserPlus },
  { kind: "sibling", label: "Sibling", icon: Users },
  { kind: "partner", label: "Partner", icon: Heart },
  { kind: "child", label: "Child", icon: Baby },
];

export function ProfilePopup({
  treeId,
  personId,
  onOpenChange,
  onOpenPerson,
  onSetMain,
}: {
  treeId: string;
  personId: string | null;
  onOpenChange: (open: boolean) => void;
  onOpenPerson: (id: string) => void;
  onSetMain: (id: string) => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [, startLoad] = useTransition();
  const [addKind, setAddKind] = useState<RelationKind | null>(null);

  const load = (id: string) =>
    startLoad(async () => setData(await getPersonProfileAction(treeId, id)));

  useEffect(() => {
    if (personId) {
      setData(null);
      load(personId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId, treeId]);

  const person = data?.person;
  const initials = person
    ? `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase()
    : "";

  return (
    <>
      <Dialog open={personId !== null} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="sr-only">
            <DialogTitle>Profile</DialogTitle>
          </DialogHeader>

          {!person ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : (
            <ScrollArea className="max-h-[85vh]">
              <div className="space-y-5 p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">
                      {person.firstName} {person.lastName}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      {lifespan(person) ? <span>{lifespan(person)}</span> : null}
                      {person.nickname ? (
                        <Badge variant="secondary">“{person.nickname}”</Badge>
                      ) : null}
                      {person.occupation ? <span>· {person.occupation}</span> : null}
                    </div>
                  </div>
                </div>

                {/* Add a relative — same controls as the profile page section */}
                <div className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="mb-3 text-sm font-semibold">Add a relative</h3>
                  <div className="flex flex-wrap gap-2">
                    {KINDS.map(({ kind, label, icon: Icon }) => (
                      <Button
                        key={kind}
                        variant="outline"
                        size="sm"
                        onClick={() => setAddKind(kind)}
                      >
                        <Icon className="mr-1 h-4 w-4" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <RelationGroup title="Parents" people={data.parents} onOpen={onOpenPerson} />
                  <RelationGroup title="Partners" people={data.partners} onOpen={onOpenPerson} />
                  <RelationGroup title="Siblings" people={data.siblings} onOpen={onOpenPerson} />
                  <RelationGroup title="Children" people={data.children} onOpen={onOpenPerson} />
                </div>

                {person.birthPlace || person.deathPlace || person.biography || person.notes ? (
                  <>
                    <Separator />
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      {person.birthPlace ? (
                        <Detail label="Birth place" value={person.birthPlace} />
                      ) : null}
                      {person.deathPlace ? (
                        <Detail label="Death place" value={person.deathPlace} />
                      ) : null}
                    </dl>
                    {person.biography ? (
                      <p className="whitespace-pre-wrap text-sm">{person.biography}</p>
                    ) : null}
                    {person.notes ? (
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                        {person.notes}
                      </p>
                    ) : null}
                  </>
                ) : null}

                <Separator />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => onSetMain(person.id)}>
                    <Crosshair className="mr-1 h-4 w-4" />
                    Set as main person
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push(`/tree/${treeId}/people?person=${person.id}`)}
                  >
                    <ExternalLink className="mr-1 h-4 w-4" />
                    Full profile
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <QuickRelativeDialog
        treeId={treeId}
        anchorId={person?.id ?? null}
        anchorLastName={person?.lastName ?? ""}
        kind={addKind}
        onOpenChange={(o) => !o && setAddKind(null)}
        afterAdd={() => {
          if (person) load(person.id);
          router.refresh();
        }}
      />
    </>
  );
}

function RelationGroup({
  title,
  people,
  onOpen,
}: {
  title: string;
  people: RelationChip[];
  onOpen: (id: string) => void;
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
            <button
              key={p.id}
              onClick={() => onOpen(p.id)}
              className="rounded-full border bg-background px-3 py-1 text-sm transition-colors hover:border-primary hover:bg-muted"
            >
              {p.firstName} {p.lastName}
              {span ? (
                <span className="ml-1 text-xs text-muted-foreground">({span})</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
