"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deletePersonAction } from "@/app/(app)/tree/[treeId]/people/actions";

export function DeletePersonButton({
  treeId,
  personId,
  name,
}: {
  treeId: string;
  personId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onDelete() {
    startTransition(async () => {
      await deletePersonAction(treeId, personId);
      toast.success(`Deleted ${name}`);
      router.push(`/tree/${treeId}/people`);
      router.refresh();
    });
  }

  return (
    <Dialog>
      <DialogTrigger
        aria-label="Delete person"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            This removes the person and their relationship links. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={onDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
