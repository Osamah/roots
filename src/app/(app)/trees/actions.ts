"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { treeSchema } from "@/lib/validations";

export type TreeFormState = { error?: string } | undefined;

export async function createTreeAction(
  _prev: TreeFormState,
  formData: FormData,
): Promise<TreeFormState> {
  const user = await requireUser();
  const parsed = treeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const tree = await prisma.tree.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      ownerId: user.id,
    },
  });
  redirect(`/tree/${tree.id}`);
}

export type UpdateTreeResult = { ok: true } | { ok: false; error: string };

export async function updateTreeAction(
  treeId: string,
  formData: FormData,
): Promise<UpdateTreeResult> {
  const user = await requireUser();
  const parsed = treeSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { count } = await prisma.tree.updateMany({
    where: { id: treeId, ownerId: user.id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
    },
  });
  if (count === 0) {
    return { ok: false, error: "Tree not found" };
  }

  revalidatePath("/trees");
  return { ok: true };
}

export async function deleteTreeAction(treeId: string) {
  const user = await requireUser();
  await prisma.tree.deleteMany({ where: { id: treeId, ownerId: user.id } });
  revalidatePath("/trees");
}
