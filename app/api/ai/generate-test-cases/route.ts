import { NextResponse } from "next/server";
import { generatedTestCasesSchema } from "@/lib/ai/schemas";
import { runStructuredOutput } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { project_id } = await request.json();
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [{ data: project }, { data: prompt }, { data: criteria }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", project_id).eq("user_id", user.id).single(),
      supabase.from("prompt_versions").select("*").eq("project_id", project_id).eq("user_id", user.id).eq("is_active", true).single(),
      supabase.from("evaluation_criteria").select("*").eq("project_id", project_id).eq("user_id", user.id)
    ]);
    if (!project || !prompt) return NextResponse.json({ error: "Project or active prompt version not found." }, { status: 404 });

    const result = await runStructuredOutput({
      schemaName: "generated_test_cases",
      schema: generatedTestCasesSchema,
      instructions:
        "Generate 10-15 realistic test cases for a golden dataset. Include normal, edge, ambiguous, missing_context, adversarial, and tone_sensitive cases. Return structured JSON only.",
      input: JSON.stringify({ project, active_prompt: prompt, evaluation_criteria: criteria }, null, 2)
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
