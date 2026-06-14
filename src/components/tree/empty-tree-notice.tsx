import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyTreeNotice({ treeId }: { treeId: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-4xl">🌱</span>
      <p className="text-muted-foreground">
        This tree has no people yet. Add some to see the visualization.
      </p>
      <Button render={<Link href={`/tree/${treeId}/people`}>Go to People</Link>} />
    </div>
  );
}
