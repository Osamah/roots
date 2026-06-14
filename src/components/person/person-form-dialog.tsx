"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { VariantProps } from "class-variance-authority";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPersonAction,
  updatePersonAction,
} from "@/app/(app)/tree/[treeId]/people/actions";

export interface PersonFormValues {
  id?: string;
  firstName?: string;
  lastName?: string;
  middleNames?: string | null;
  nickname?: string | null;
  gender?: string;
  birthDate?: string | null;
  birthPlace?: string | null;
  deathDate?: string | null;
  deathPlace?: string | null;
  occupation?: string | null;
  biography?: string | null;
  notes?: string | null;
}

export function PersonFormDialog({
  treeId,
  mode,
  person,
  children,
  triggerVariant,
  triggerSize,
  triggerClassName,
  triggerLabel,
}: {
  treeId: string;
  mode: "create" | "edit";
  person?: PersonFormValues;
  /** Content inside the trigger button (icon + label). */
  children: React.ReactNode;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerSize?: VariantProps<typeof buttonVariants>["size"];
  triggerClassName?: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res =
        mode === "edit" && person?.id
          ? await updatePersonAction(treeId, person.id, formData)
          : await createPersonAction(treeId, formData);
      if (res.ok) {
        toast.success(mode === "edit" ? "Saved" : "Person created");
        setOpen(false);
        router.push(`/tree/${treeId}/people?person=${res.personId}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label={triggerLabel}
        className={cn(
          buttonVariants({ variant: triggerVariant, size: triggerSize }),
          triggerClassName,
        )}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit person" : "Add a person"}
          </DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" name="firstName" defaultValue={person?.firstName} required />
            <Field label="Last name" name="lastName" defaultValue={person?.lastName} />
            <Field label="Middle names" name="middleNames" defaultValue={person?.middleNames} />
            <Field label="Nickname" name="nickname" defaultValue={person?.nickname} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-gender">Gender</Label>
            <Select name="gender" defaultValue={person?.gender ?? "UNKNOWN"}>
              <SelectTrigger id="pf-gender">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="UNKNOWN">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Born" name="birthDate" defaultValue={person?.birthDate} placeholder="1954" />
            <Field label="Birth place" name="birthPlace" defaultValue={person?.birthPlace} />
            <Field label="Died" name="deathDate" defaultValue={person?.deathDate} />
            <Field label="Death place" name="deathPlace" defaultValue={person?.deathPlace} />
          </div>
          <Field label="Occupation" name="occupation" defaultValue={person?.occupation} />
          <div className="space-y-2">
            <Label htmlFor="pf-bio">Biography</Label>
            <Textarea id="pf-bio" name="biography" rows={3} defaultValue={person?.biography ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-notes">Notes</Label>
            <Textarea id="pf-notes" name="notes" rows={2} defaultValue={person?.notes ?? ""} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Create person"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
}) {
  const id = `pf-${name}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
