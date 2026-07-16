import { NextResponse } from "next/server";
import { generatedTestCasesSchema } from "@/lib/ai/schemas";
import { getWorkspaceProject } from "@/lib/data";
import { runStructuredOutput } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { workspace_slug, project_id } = await request.json();
    const supabase = await createClient();
    const context = await getWorkspaceProject(supabase, workspace_slug, project_id);
    if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });

    const [{ data: prompt, error: promptError }, { data: criteria, error: criteriaError }] = await Promise.all([
      supabase.from("prompt_versions").select("*").eq("project_id", project_id).eq("is_active", true).maybeSingle(),
      supabase.from("evaluation_criteria").select("*").eq("project_id", project_id)
    ]);
    if (promptError) throw promptError;
    if (criteriaError) throw criteriaError;
    if (!prompt) return NextResponse.json({ error: "Active prompt version not found." }, { status: 404 });

    const result = await runStructuredOutput({
      schemaName: "generated_test_cases",
      schema: generatedTestCasesSchema,
      instructions:
        "Generate 10-15 realistic test cases for a golden dataset. Include normal, edge, ambiguous, missing_context, adversarial, and tone_sensitive cases. Return structured JSON only.",
      input: JSON.stringify({ project: context.project, active_prompt: prompt, evaluation_criteria: criteria }, null, 2)
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
