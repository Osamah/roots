"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface TimelineEvent {
  year: number;
  type: "birth" | "death" | "marriage";
  text: string;
  detail?: string;
  personId?: string;
  treeId: string;
}

const TYPE_STYLE: Record<TimelineEvent["type"], string> = {
  birth: "bg-emerald-500",
  death: "bg-slate-500",
  marriage: "bg-rose-500",
};

export function TimelineView({ events }: { events: TimelineEvent[] }) {
  const centuries = useMemo(() => {
    const set = new Set<number>();
    for (const e of events) set.add(Math.floor(e.year / 100) * 100);
    return [...set].sort((a, b) => a - b);
  }, [events]);

  const [century, setCentury] = useState<number | "all">("all");

  const filtered = useMemo(() => {
    const list =
      century === "all"
        ? events
        : events.filter((e) => Math.floor(e.year / 100) * 100 === century);
    return [...list].sort((a, b) => a.year - b.year);
  }, [events, century]);

  if (events.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground">
        No dated events yet. Add birth, death, or marriage dates to build the
        timeline.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Filter:</span>
        <FilterChip active={century === "all"} onClick={() => setCentury("all")}>
          All
        </FilterChip>
        {centuries.map((c) => (
          <FilterChip key={c} active={century === c} onClick={() => setCentury(c)}>
            {c}s
          </FilterChip>
        ))}
      </div>

      <ol className="relative border-l-2 border-border pl-6">
        {filtered.map((e, i) => (
          <li key={i} className="mb-6 last:mb-0">
            <span
              className={cn(
                "absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full",
                TYPE_STYLE[e.type],
              )}
            />
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-semibold">{e.year}</span>
              <Badge variant="secondary" className="capitalize">
                {e.type}
              </Badge>
            </div>
            <div className="mt-0.5">
              {e.personId ? (
                <Link
                  href={`/tree/${e.treeId}/people?person=${e.personId}`}
                  className="font-medium hover:underline"
                >
                  {e.text}
                </Link>
              ) : (
                <span className="font-medium">{e.text}</span>
              )}
              {e.detail ? (
                <span className="text-sm text-muted-foreground"> · {e.detail}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
