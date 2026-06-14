import { requireTreeAccess } from "@/lib/session";
import { computeTreeStats } from "@/lib/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StatsPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = await params;
  await requireTreeAccess(treeId);
  const stats = await computeTreeStats(treeId);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <h1 className="text-xl font-bold">Statistics</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Total people" value={stats.totalPeople} />
        <MetricCard label="Generations" value={stats.generations} />
        <MetricCard label="Living" value={stats.living} />
        <MetricCard label="Deceased" value={stats.deceased} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <HighlightCard
          title="Largest branch"
          primary={stats.largestBranch?.name ?? "—"}
          secondary={
            stats.largestBranch
              ? `${stats.largestBranch.size} people`
              : "No data"
          }
        />
        <HighlightCard
          title="Oldest ancestor"
          primary={stats.oldestAncestor?.name ?? "—"}
          secondary={
            stats.oldestAncestor ? `b. ${stats.oldestAncestor.year}` : "No data"
          }
        />
        <HighlightCard
          title="Most descendants"
          primary={stats.mostDescendants?.name ?? "—"}
          secondary={
            stats.mostDescendants
              ? `${stats.mostDescendants.count} descendants`
              : "No data"
          }
        />
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-6 text-center">
        <div className="text-3xl font-bold">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function HighlightCard({
  title,
  primary,
  secondary,
}: {
  title: string;
  primary: string;
  secondary: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-semibold">{primary}</div>
        <div className="text-sm text-muted-foreground">{secondary}</div>
      </CardContent>
    </Card>
  );
}
