import { ReportsWorkspace } from "@/components/reports-workspace";
import { ButtonLink, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function ReportsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: reports } = await supabase.from("error_analysis_reports").select("*").eq("project_id", projectId).order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader eyebrow="Error analysis" title="Error Analysis" actions={<ButtonLink variant="secondary" href={`/api/export/project-csv?projectId=${projectId}`}>Export CSV</ButtonLink>}>
        Summarize reviewed failures, identify root causes, and draft a safer next prompt version.
      </PageHeader>
      <ReportsWorkspace projectId={projectId} reports={reports || []} />
    </div>
  );
}
