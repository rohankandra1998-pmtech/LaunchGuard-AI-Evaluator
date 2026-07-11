import { ReportsWorkspace } from "@/components/reports-workspace";
import { ButtonLink, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function ReportsPage({ params }: { params: Promise<{ workspaceSlug: string; projectId: string }> }) {
  const { workspaceSlug, projectId } = await params;
  const supabase = await createClient();
  const { data: reports } = await supabase.from("error_analysis_reports").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  const exportUrl = `/api/export/project-csv?workspaceSlug=${encodeURIComponent(workspaceSlug)}&projectId=${encodeURIComponent(projectId)}`;
  return <div><PageHeader eyebrow="Error analysis" title="Error Analysis" actions={<ButtonLink variant="secondary" href={exportUrl}>Export CSV</ButtonLink>}>Summarize reviewed failures, identify root causes, and draft a safer next prompt version.</PageHeader><ReportsWorkspace workspaceSlug={workspaceSlug} projectId={projectId} reports={reports || []} /></div>;
}
