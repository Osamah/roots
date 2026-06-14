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

export async function deleteTreeAction(treeId: string) {
  const user = await requireUser();
  await prisma.tree.deleteMany({ where: { id: treeId, ownerId: user.id } });
  revalidatePath("/trees");
}
