"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchAction } from "@/app/(app)/tree/[treeId]/search-action";
import type { SearchHit } from "@/lib/search";
import { lifespan } from "@/lib/graph";

export function TreeSearch({ treeId }: { treeId: string }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) {
      setHits([]);
      return;
    }
    debounce.current = setTimeout(() => {
      startTransition(async () => {
        setHits(await searchAction(treeId, query));
      });
    }, 180);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, treeId]);

  function focusPerson(id: string) {
    setOpen(false);
    setQuery("");
    const base = `/tree/${treeId}`;
    // Focus in the current view if it's 2D or 3D; otherwise open the profile.
    if (pathname.startsWith(`${base}/2d`)) {
      router.push(`${base}/2d?focus=${id}`);
    } else if (pathname.startsWith(`${base}/3d`)) {
      router.push(`${base}/3d?focus=${id}`);
    } else {
      router.push(`${base}/people?person=${id}`);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden rounded bg-muted px-1.5 text-xs sm:inline">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search by name, place, occupation…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query ? "No people found." : "Type to search."}
          </CommandEmpty>
          {hits.length > 0 ? (
            <CommandGroup heading="People">
              {hits.map((hit) => {
                const span = lifespan(hit);
                return (
                  <CommandItem
                    key={hit.id}
                    value={`${hit.firstName} ${hit.lastName} ${hit.id}`}
                    onSelect={() => focusPerson(hit.id)}
                  >
                    <div className="flex flex-col">
                      <span>
                        {hit.firstName} {hit.lastName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[span, hit.occupation, hit.birthPlace]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </>
  );
}
