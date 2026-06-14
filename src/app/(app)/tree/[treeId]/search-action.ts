"use server";

import { requireTreeAccess } from "@/lib/session";
import { searchPeopleInTree, type SearchHit } from "@/lib/search";

export async function searchAction(
  treeId: string,
  query: string,
): Promise<SearchHit[]> {
  await requireTreeAccess(treeId);
  return searchPeopleInTree(treeId, query);
}
