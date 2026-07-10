import { ReviewWorkspace } from "@/components/review-workspace";
import { PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export default async function ReviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const supabase = await createClient();
  const [{ data: testCases }, { data: criteria }, { data: reviews }, { data: ratings }, { data: promptVersions }] = await Promise.all([
    supabase.from("test_cases").select("*").eq("project_id", projectId).in("status", ["generated", "reviewed"]).order("updated_at", { ascending: false }),
    supabase.from("evaluation_criteria").select("*").eq("project_id", projectId).order("created_at"),
    supabase.from("human_reviews").select("*").eq("project_id", projectId),
    supabase.from("human_review_ratings").select("*"),
    supabase.from("prompt_versions").select("*").eq("project_id", projectId)
  ]);

  return (
    <div>
      <PageHeader eyebrow="Human review" title="Human Review">
        Inspect input-output pairs, rate each criterion, annotate failures, and mark outputs as reviewed.
      </PageHeader>
      <ReviewWorkspace
        projectId={projectId}
        testCases={testCases || []}
        criteria={criteria || []}
        reviews={reviews || []}
        ratings={ratings || []}
        promptVersions={promptVersions || []}
      />
    </div>
  );
}
