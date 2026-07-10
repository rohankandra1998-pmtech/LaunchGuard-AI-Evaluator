import { NextResponse } from "next/server";
import { suggestedCriteriaSchema } from "@/lib/ai/schemas";
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

    const [{ data: project }, { data: prompt }] = await Promise.all([
      supabase.from("projects").select("*").eq("id", project_id).eq("user_id", user.id).single(),
      supabase.from("prompt_versions").select("*").eq("project_id", project_id).eq("user_id", user.id).eq("is_active", true).single()
    ]);
    if (!project || !prompt) return NextResponse.json({ error: "Project or active prompt version not found." }, { status: 404 });

    const result = await runStructuredOutput({
      schemaName: "suggested_criteria",
      schema: suggestedCriteriaSchema,
      instructions: "You are an expert AI product evaluator. Return 5-7 crisp human evaluation criteria as structured JSON.",
      input: JSON.stringify({ project, active_prompt: prompt }, null, 2)
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
