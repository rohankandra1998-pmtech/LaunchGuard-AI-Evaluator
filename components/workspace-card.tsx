import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, Building2, CircleCheck, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type WorkspaceViewModel = {
  id: string;
  slug: string;
  name: string;
  description: string;
  updatedAt: string;
  updatedLabel: string;
  projectCount: number;
  testCaseCount: number;
  reviewedCount: number;
};

export function WorkspaceCard({
  workspace,
  view
}: {
  workspace: WorkspaceViewModel;
  view: "grid" | "list";
}) {
  const workspaceStats = [
    { label: "Projects", value: workspace.projectCount, icon: BriefcaseBusiness },
    { label: "Test Cases", value: workspace.testCaseCount, icon: Code2 },
    { label: "Reviewed", value: workspace.reviewedCount, icon: CircleCheck }
  ];

  const stats = (
    <dl className={cn("grid grid-cols-3 gap-3 border-t border-guard-line pt-4", view === "list" && "min-w-72 border-l border-t-0 pl-6 pt-0")}>
      {workspaceStats.map(({ label, value, icon: Icon }) => (
        <div key={label}>
          <dt className="flex items-center gap-1.5 whitespace-nowrap text-xs text-guard-muted">
            <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-guard-primary" />
            {label}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-guard-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <Link
      href={`/workspaces/${workspace.slug}`}
      aria-label={`Open ${workspace.name}`}
      className={cn(
        "group focus-ring flex rounded-xl border border-guard-line bg-guard-surface p-4 shadow-card transition duration-200 motion-reduce:transition-none hover:-translate-y-0.5 hover:border-guard-primaryLine hover:shadow-floating motion-reduce:hover:translate-y-0",
        view === "grid" ? "min-h-72 flex-col" : "flex-col gap-5 sm:p-5 lg:flex-row lg:items-center"
      )}
    >
      <div className={cn(view === "grid" ? "flex min-h-0 flex-1 flex-col" : "min-w-0 flex-1")}>
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-guard-primarySoft text-guard-primary">
          <Building2 aria-hidden="true" className="h-5 w-5" />
        </span>
        <h2 className="mt-4 break-words text-base font-semibold tracking-tight text-guard-ink">{workspace.name}</h2>
        <p className={cn("mt-1.5 text-sm leading-5 text-guard-muted", view === "grid" && "min-h-10")}>{workspace.description}</p>
        {view === "grid" ? <div className="mt-auto pt-5">{stats}</div> : null}
      </div>
      {view === "list" ? stats : null}
      <div className={cn("flex items-center justify-between border-t border-guard-line pt-3 text-xs text-guard-muted", view === "grid" ? "mt-4" : "w-full lg:w-auto lg:min-w-64 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0")}>
        <span className="leading-5">{workspace.updatedLabel}</span>
        <span className="ml-4 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-guard-primaryLine px-3 py-1.5 font-semibold text-guard-primary transition group-hover:bg-guard-primarySoft">
          Open <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </span>
      </div>
    </Link>
  );
}
