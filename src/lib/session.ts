import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Returns the current user or redirects to /login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

/**
 * Ensures the current user can access a tree (owner or member).
 * Redirects to /trees if not. Returns the tree.
 */
export async function requireTreeAccess(treeId: string) {
  const user = await requireUser();
  const tree = await prisma.tree.findFirst({
    where: {
      id: treeId,
      OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }],
    },
  });
  if (!tree) redirect("/trees");
  return { tree, user };
}
