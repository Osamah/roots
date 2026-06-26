"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { lifespan, type GraphPerson } from "@/lib/graph";

export interface ListPerson extends GraphPerson {}

export function PeopleList({
  treeId,
  people,
  selectedId,
}: {
  treeId: string;
  people: ListPerson[];
  selectedId?: string;
}) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return people;
    return people.filter((p) =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(t),
    );
  }, [q, people]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <Input
          placeholder={`Filter ${people.length} people…`}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <ul className="p-2">
          {filtered.map((p) => {
            const span = lifespan(p);
            return (
              <li key={p.id}>
                <Link
                  href={`/tree/${treeId}/people?person=${p.id}`}
                  scroll={false}
                  className={cn(
                    "block rounded-md px-3 py-2 text-sm transition-colors",
                    p.id === selectedId
                      ? "bg-primary/10 font-medium text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  <div>
                    {p.firstName} {p.lastName}
                  </div>
                  {span ? (
                    <div className="text-xs text-muted-foreground">{span}</div>
                  ) : null}
                </Link>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No matches.
            </li>
          ) : null}
        </ul>
      </ScrollArea>
    </div>
  );
}
