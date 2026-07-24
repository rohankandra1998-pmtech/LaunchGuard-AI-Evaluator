import Link from "next/link";
import { BriefcaseBusiness, ChevronRight, CircleCheck, CirclePlus, Code2, Home, PanelsTopLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { WorkspaceHeroIllustration } from "@/components/workspace-hero-illustration";
import { WorkspacesDirectory } from "@/components/workspaces-directory";
import type { WorkspaceViewModel } from "@/components/workspace-card";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC"
});

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const [{ data: workspaces, error }, { data: activeProjects, error: projectsError }] = await Promise.all([
    supabase.from("workspaces").select("*").order("updated_at", { ascending: false }),
    supabase.from("projects").select("id, workspace_id, test_cases(id, status)").is("trashed_at", null)
  ]);
  if (error) throw error;
  if (projectsError) throw projectsError;

  const statsByWorkspace = new Map<string, { projectCount: number; testCaseCount: number; reviewedCount: number }>();
  let totalProjects = 0;
  let totalTestCases = 0;
  let totalReviewed = 0;

  for (const project of activeProjects ?? []) {
    const testCases = project.test_cases ?? [];
    const reviewedCount = testCases.reduce((count, testCase) => count + (testCase.status === "reviewed" ? 1 : 0), 0);
    const current = statsByWorkspace.get(project.workspace_id) ?? { projectCount: 0, testCaseCount: 0, reviewedCount: 0 };
    current.projectCount += 1;
    current.testCaseCount += testCases.length;
    current.reviewedCount += reviewedCount;
    statsByWorkspace.set(project.workspace_id, current);
    totalProjects += 1;
    totalTestCases += testCases.length;
    totalReviewed += reviewedCount;
  }

  const workspaceModels: WorkspaceViewModel[] = (workspaces ?? []).map((workspace) => {
    const stats = statsByWorkspace.get(workspace.id) ?? { projectCount: 0, testCaseCount: 0, reviewedCount: 0 };
    return {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      description: workspace.description || "Open workspace for collaborative AI evaluation.",
      updatedAt: workspace.updated_at,
      updatedLabel: `Updated ${dateFormatter.format(new Date(workspace.updated_at))}`,
      ...stats
    };
  });

  const summary = [
    { label: "Total Workspaces", value: workspaceModels.length, icon: PanelsTopLeft },
    { label: "Projects", value: totalProjects, icon: BriefcaseBusiness },
    { label: "Test Cases", value: totalTestCases, icon: Code2 },
    { label: "Reviewed", value: totalReviewed, icon: CircleCheck }
  ];

  return (
    <div className="mx-auto max-w-[1680px]">
      <section className="relative">
        <nav aria-label="Breadcrumb" className="mb-5">
          <ol className="flex items-center gap-2 text-xs font-medium text-guard-muted">
            <li><Link href="/" aria-label="Home" className="focus-ring rounded p-1 hover:text-guard-primary"><Home aria-hidden="true" className="h-4 w-4" /></Link></li>
            <li aria-hidden="true"><ChevronRight className="h-3.5 w-3.5" /></li>
            <li aria-current="page">Workspaces</li>
          </ol>
        </nav>
        <div className="flex items-start justify-between gap-8">
          <div className="max-w-2xl">
            <h1 className="text-4xl font-semibold tracking-[-0.035em] text-guard-ink sm:text-5xl">Your Workspaces</h1>
            <p className="mt-4 text-sm leading-6 text-guard-text sm:text-base">
              Open, manage, and collaborate across AI evaluation workspaces.<br className="hidden sm:block" />
              Create a new workspace to organize projects, test cases, and reviews.
            </p>
          </div>
          <WorkspaceHeroIllustration />
          <ButtonLink href="/workspaces/new"><CirclePlus aria-hidden="true" className="mr-2 h-4 w-4" />Create Workspace</ButtonLink>
        </div>
      </section>

      <section aria-label="Workspace summary" className="mt-7 grid overflow-hidden rounded-xl border border-guard-line bg-guard-surface shadow-card sm:grid-cols-2 lg:grid-cols-4">
        {summary.map(({ label, value, icon: Icon }, index) => (
          <div key={label} className={`flex items-center gap-4 p-5 sm:p-6 ${index > 0 ? "border-t border-guard-line sm:border-t-0 sm:[&:nth-child(2n)]:border-l lg:border-l" : ""} ${index > 1 ? "sm:border-t lg:border-t-0" : ""}`}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-guard-primarySoft text-guard-primary">
              <Icon aria-hidden="true" className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-semibold text-guard-muted">{label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-guard-ink">{value}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="mt-4">
        <WorkspacesDirectory workspaces={workspaceModels} />
      </div>
    </div>
  );
}
