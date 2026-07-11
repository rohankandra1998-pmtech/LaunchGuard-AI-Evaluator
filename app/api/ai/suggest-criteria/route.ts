import { NextResponse } from "next/server";
import { suggestedCriteriaSchema } from "@/lib/ai/schemas";
import { getWorkspaceProject } from "@/lib/data";
import { runStructuredOutput } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { workspace_slug, project_id } = await request.json();
    const supabase = await createClient();
    const context = await getWorkspaceProject(supabase, workspace_slug, project_id);
    if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });

    const { data: prompt, error } = await supabase
      .from("prompt_versions")
      .select("*")
      .eq("project_id", context.project.id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (!prompt) return NextResponse.json({ error: "Active prompt version not found." }, { status: 404 });

    const result = await runStructuredOutput({
      schemaName: "suggested_criteria",
      schema: suggestedCriteriaSchema,
      instructions: "You are an expert AI product evaluator. Return 5-7 crisp human evaluation criteria as structured JSON.",
      input: JSON.stringify({ project: context.project, active_prompt: prompt }, null, 2)
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
