import { DatasetWorkspace } from "@/components/dataset-workspace";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function DatasetPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: prompts }, { data: criteria }, { data: testCases }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).single(),
    supabase.from("prompt_versions").select("*").eq("project_id", projectId).order("version_number"),
    supabase.from("evaluation_criteria").select("*").eq("project_id", projectId),
    supabase.from("test_cases").select("*").eq("project_id", projectId).order("created_at", { ascending: false })
  ]);

  return (
    <div>
      <PageHeader eyebrow="Golden dataset" title="Golden Dataset">
        Create, filter, and run test cases against selected prompt versions. Outputs are saved with the prompt version and model used.
      </PageHeader>
      <DatasetWorkspace project={project} promptVersions={prompts || []} criteria={criteria || []} testCases={testCases || []} />
    </div>
  );
}
