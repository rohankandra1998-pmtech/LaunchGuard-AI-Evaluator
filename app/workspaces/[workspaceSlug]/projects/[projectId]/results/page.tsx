import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

function countBy<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((acc, item) => { acc[item || "None"] = (acc[item || "None"] || 0) + 1; return acc; }, {});
}

export default async function ResultsPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const [{ data: testCases }, { data: reviews }, { data: criteria }] = await Promise.all([
    supabase.from("test_cases").select("*").eq("project_id", projectId),
    supabase.from("human_reviews").select("*").eq("project_id", projectId),
    supabase.from("evaluation_criteria").select("*").eq("project_id", projectId)
  ]);
  const reviewIds = (reviews || []).map((review) => review.id);
  const { data: ratings } = reviewIds.length ? await supabase.from("human_review_ratings").select("*").in("review_id", reviewIds) : { data: [] };
  const projectRatings = ratings || [];
  const avg = projectRatings.length ? (projectRatings.reduce((sum, rating) => sum + rating.rating_score, 0) / projectRatings.length).toFixed(2) : "N/A";
  const ratingDist = countBy(projectRatings.map((rating) => rating.rating_label));
  const severityDist = countBy((reviews || []).map((review) => review.severity || "None"));
  const failureDist = countBy((reviews || []).map((review) => review.failure_category || "None"));
  const criterionScores = (criteria || []).map((criterion) => {
    const rows = projectRatings.filter((rating) => rating.criterion_id === criterion.id);
    return { criterion, average: rows.length ? rows.reduce((sum, row) => sum + row.rating_score, 0) / rows.length : 0, count: rows.length };
  }).sort((a, b) => a.average - b.average);
  const reviewByCase = new Map((reviews || []).map((review) => [review.test_case_id, review]));
  const worstCases = (testCases || []).filter((testCase) => reviewByCase.has(testCase.id)).map((testCase) => {
    const review = reviewByCase.get(testCase.id)!;
    const rows = projectRatings.filter((rating) => rating.review_id === review.id);
    return { testCase, review, average: rows.length ? rows.reduce((sum, row) => sum + row.rating_score, 0) / rows.length : 0 };
  }).sort((a, b) => a.average - b.average).slice(0, 8);

  return (
    <div>
      <PageHeader eyebrow="Launch readiness" title="Results Dashboard">Calculate human scores, rating distribution, severity spread, weakest criteria, and worst-performing test cases.</PageHeader>
      <div className="grid gap-4 md:grid-cols-4"><StatCard label="Total test cases" value={testCases?.length || 0} /><StatCard label="Reviewed test cases" value={reviews?.length || 0} /><StatCard label="Average human score" value={avg} /><StatCard label="Weakest criteria" value={criterionScores.filter((row) => row.count).length ? criterionScores[0].criterion.name : "N/A"} /></div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3"><Card><h2 className="text-lg font-semibold text-white">Good / Average / Bad</h2><Distribution data={ratingDist} /></Card><Card><h2 className="text-lg font-semibold text-white">Severity distribution</h2><Distribution data={severityDist} /></Card><Card><h2 className="text-lg font-semibold text-white">Failure categories</h2><Distribution data={failureDist} /></Card></div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><h2 className="text-lg font-semibold text-white">Score by criterion</h2><div className="mt-4 space-y-3">{criterionScores.length ? criterionScores.map(({ criterion, average, count }) => <div key={criterion.id}><div className="mb-1 flex justify-between text-sm"><span>{criterion.name}</span><span>{count ? average.toFixed(2) : "No ratings"}</span></div><div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-guard-cyan" style={{ width: `${Math.min(100, (average / 3) * 100)}%` }} /></div></div>) : <EmptyState title="No criteria">Add criteria and review outputs to calculate scores.</EmptyState>}</div></Card>
        <Card><h2 className="text-lg font-semibold text-white">Worst-performing test cases</h2><div className="mt-4 space-y-3">{worstCases.length ? worstCases.map(({ testCase, review, average }) => <div key={testCase.id} className="rounded-md border border-white/10 bg-slate-950/35 p-4"><div className="flex items-center justify-between gap-3"><p className="line-clamp-2 text-sm text-white">{testCase.user_input}</p><Badge tone={average >= 2.5 ? "good" : average >= 1.7 ? "average" : "bad"}>{average.toFixed(2)}</Badge></div><p className="mt-2 text-xs text-slate-400">{review.failure_category || "No category"} / {review.severity || "No severity"}</p></div>) : <EmptyState title="No reviewed cases">Complete Human Review to populate worst-performing cases.</EmptyState>}</div></Card>
      </div>
    </div>
  );
}

function Distribution({ data }: { data: Record<string, number> }) {
  const total = Object.values(data).reduce((sum, value) => sum + value, 0);
  if (!total) return <EmptyState title="No data">Review outputs to populate this distribution.</EmptyState>;
  return <div className="mt-4 space-y-3">{Object.entries(data).map(([label, value]) => <div key={label}><div className="mb-1 flex justify-between text-sm"><span>{label}</span><span>{value}</span></div><div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-guard-green" style={{ width: `${(value / total) * 100}%` }} /></div></div>)}</div>;
}
