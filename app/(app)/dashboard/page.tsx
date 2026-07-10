import { PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: projects }, { data: runs }, { data: ratings }] = await Promise.all([
    supabase.from("projects").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("eval_runs").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("human_review_ratings").select("rating_score").eq("user_id", user!.id)
  ]);

  const avg = ratings?.length ? (ratings.reduce((sum, row) => sum + row.rating_score, 0) / ratings.length).toFixed(2) : "N/A";

  return (
    <div>
      <PageHeader
        eyebrow="LaunchGuard AI Evaluator"
        title="Evaluation Dashboard"
        actions={
          <ButtonLink href="/projects/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create AI Project
          </ButtonLink>
        }
      >
        Track prompt readiness, recent runs, and the human review signal that should shape your next prompt version.
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total projects" value={projects?.length || 0} />
        <StatCard label="Latest eval runs" value={runs?.length || 0} />
        <StatCard label="Average human review score" value={avg} detail="Good = 3, Average = 2, Bad = 1" />
        <StatCard label="Review mode" value="Human" detail="LLM-as-a-judge prepared for v2" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <h2 className="text-lg font-semibold text-white">Recent projects</h2>
          <div className="mt-4 space-y-3">
            {projects?.length ? (
              projects.slice(0, 6).map((project) => (
                <a key={project.id} href={`/projects/${project.id}`} className="block rounded-md border border-white/10 bg-slate-950/35 p-4 hover:bg-white/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{project.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{project.product_type || "AI product"}</p>
                    </div>
                    <Badge tone="cyan">Open</Badge>
                  </div>
                </a>
              ))
            ) : (
              <EmptyState title="No projects yet">Create your first AI project to start building a golden dataset and human review loop.</EmptyState>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-white">Latest eval runs</h2>
          <div className="mt-4 space-y-3">
            {runs?.length ? (
              runs.map((run) => (
                <div key={run.id} className="rounded-md border border-white/10 bg-slate-950/35 p-4">
                  <p className="text-sm font-medium text-white">{run.model_used}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {run.test_case_count} test cases · {new Date(run.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState title="No runs yet">Run AI outputs from a project dataset and the latest activity will appear here.</EmptyState>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
