import { NextResponse } from "next/server";
import { suggestedCriteriaSchema } from "@/lib/ai/schemas";
import { normalizeCriterionName } from "@/lib/criteria";
import { getWorkspaceProject } from "@/lib/data";
import { runStructuredOutput } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { workspace_slug, project_id } = await request.json();
    const supabase = await createClient();
    const context = await getWorkspaceProject(supabase, workspace_slug, project_id);
    if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });

    const [{ data: prompt, error }, orderedCriteriaResult] = await Promise.all([
      supabase
        .from("prompt_versions")
        .select("system_prompt, variable_schema")
        .eq("project_id", context.project.id)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("evaluation_criteria")
        .select("name, category, description, good_definition, average_definition, bad_definition")
        .eq("project_id", context.project.id)
        .order("sort_order")
        .order("created_at")
        .order("id")
    ]);
    if (error) throw error;
    if (!prompt) return NextResponse.json({ error: "Active prompt version not found." }, { status: 404 });

    let existingCriteria = orderedCriteriaResult.data;
    if (orderedCriteriaResult.error?.code === "42703") {
      const fallback = await supabase
        .from("evaluation_criteria")
        .select("name, category, description, good_definition, average_definition, bad_definition")
        .eq("project_id", context.project.id)
        .order("created_at")
        .order("id");
      if (fallback.error) throw fallback.error;
      existingCriteria = fallback.data;
    } else if (orderedCriteriaResult.error) {
      throw orderedCriteriaResult.error;
    }

    const project = {
      name: context.project.name,
      product_type: context.project.product_type,
      goal: context.project.goal,
      target_user: context.project.target_user,
      description: context.project.description,
      variables: context.project.variables
    };

    const result = await runStructuredOutput({
      schemaName: "suggested_criteria",
      schema: suggestedCriteriaSchema,
      instructions: [
        "You are an expert AI product evaluator identifying meaningful gaps in an existing human-review rubric.",
        "Return zero to three evaluation criteria. Do not generate criteria merely to reach a target count.",
        "Only suggest criteria that cover important evaluation dimensions not already addressed by the saved rubric.",
        "Do not repeat or closely overlap with any existing criterion, and make every new suggestion distinct from the others.",
        "Use concise, clear, practical language.",
        "For Good, Average, and Bad, provide actionable and observable definitions that different human reviewers can apply consistently.",
        "If the existing rubric already covers the important dimensions, return an empty criteria array."
      ].join(" "),
      input: JSON.stringify({ project, active_prompt: prompt, existing_criteria: existingCriteria || [] }, null, 2)
    });

    const existingNames = new Set((existingCriteria || []).map((criterion) => normalizeCriterionName(criterion.name)));
    const generatedNames = new Set<string>();
    const criteria = result.criteria.filter((criterion) => {
      const normalizedName = normalizeCriterionName(criterion.name);
      if (!normalizedName || existingNames.has(normalizedName) || generatedNames.has(normalizedName)) return false;
      generatedNames.add(normalizedName);
      return true;
    }).slice(0, 3);

    return NextResponse.json({ criteria });
  } catch (error) {
    console.error("Criteria suggestion generation failed", error);
    return NextResponse.json({ error: "Could not generate criteria suggestions." }, { status: 500 });
  }
}
