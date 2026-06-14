"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  addRelativeAction,
  linkRelativeAction,
} from "@/app/(app)/tree/[treeId]/people/actions";
import { searchAction } from "@/app/(app)/tree/[treeId]/search-action";
import type { SearchHit } from "@/lib/search";
import { lifespan } from "@/lib/graph";
import type { RelationKind } from "@/lib/relationships";

type Mode = "new" | "existing";

/**
 * Controlled mini-form for adding one relative of a given kind — either by
 * creating a new person or by linking an existing one. Shared by the person
 * profile and the 2D context menu.
 */
export function QuickRelativeDialog({
  treeId,
  anchorId,
  anchorLastName,
  kind,
  onOpenChange,
  afterAdd,
}: {
  treeId: string;
  anchorId: string | null;
  anchorLastName: string;
  kind: RelationKind | null;
  onOpenChange: (open: boolean) => void;
  /** Called with the relative's id. If omitted, navigates to the profile. */
  afterAdd?: (personId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("new");
  const router = useRouter();

  const defaultLastName = kind && kind !== "partner" ? anchorLastName : "";

  // Reset to "new" each time a different relation is opened.
  useEffect(() => {
    if (kind) setMode("new");
  }, [kind]);

  function done(personId: string, msg: string) {
    toast.success(msg);
    onOpenChange(false);
    if (afterAdd) afterAdd(personId);
    else router.push(`/tree/${treeId}/people?person=${personId}`);
    router.refresh();
  }

  function onCreate(formData: FormData) {
    if (!kind || !anchorId) return;
    formData.set("kind", kind);
    startTransition(async () => {
      const res = await addRelativeAction(treeId, anchorId, formData);
      if (res.ok) done(res.personId, "Relative added");
      else toast.error(res.error);
    });
  }

  function onLink(personId: string) {
    if (!kind || !anchorId) return;
    startTransition(async () => {
      const res = await linkRelativeAction(treeId, anchorId, kind, personId);
      if (res.ok) done(res.personId, "Relative linked");
      else toast.error(res.error);
    });
  }

  return (
    <Dialog open={kind !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="capitalize">Add {kind}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-md bg-muted p-1 text-sm">
          <ModeTab active={mode === "new"} onClick={() => setMode("new")}>
            New person
          </ModeTab>
          <ModeTab active={mode === "existing"} onClick={() => setMode("existing")}>
            Existing person
          </ModeTab>
        </div>

        {mode === "new" ? (
          <form key={kind} action={onCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="qa-first">First name</Label>
                <Input id="qa-first" name="firstName" required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa-last">Last name</Label>
                <Input id="qa-last" name="lastName" defaultValue={defaultLastName} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="qa-gender">Gender</Label>
                <Select name="gender" defaultValue="UNKNOWN">
                  <SelectTrigger id="qa-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                    <SelectItem value="UNKNOWN">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa-birth">Born</Label>
                <Input id="qa-birth" name="birthDate" placeholder="1980" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qa-death">Died</Label>
                <Input id="qa-death" name="deathDate" placeholder="—" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Adding…" : `Add ${kind}`}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <ExistingPicker
            treeId={treeId}
            excludeId={anchorId}
            pending={pending}
            onPick={onLink}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModeTab({
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
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded px-3 py-1.5 font-medium transition-colors",
        active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ExistingPicker({
  treeId,
  excludeId,
  pending,
  onPick,
}: {
  treeId: string;
  excludeId: string | null;
  pending: boolean;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [, startSearch] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) {
      setHits([]);
      return;
    }
    debounce.current = setTimeout(() => {
      startSearch(async () => {
        const results = await searchAction(treeId, query);
        setHits(results.filter((h) => h.id !== excludeId));
      });
    }, 180);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, treeId, excludeId]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people by name…"
          className="pl-8"
        />
      </div>
      <ScrollArea className="h-56 rounded-md border">
        {hits.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {query ? "No matches." : "Type to search existing people."}
          </p>
        ) : (
          <ul className="p-1">
            {hits.map((h) => {
              const span = lifespan(h);
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onPick(h.id)}
                    className="flex w-full flex-col rounded px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
                  >
                    <span>
                      {h.firstName} {h.lastName}
                    </span>
                    {span || h.birthPlace || h.occupation ? (
                      <span className="text-xs text-muted-foreground">
                        {[span, h.occupation, h.birthPlace].filter(Boolean).join(" · ")}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}
