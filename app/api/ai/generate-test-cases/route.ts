import { NextResponse } from "next/server";
import { z } from "zod";
import { generatedTestCasesSchemaForVariables } from "@/lib/ai/schemas";
import { getWorkspaceProject } from "@/lib/data";
import { runStructuredOutput } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { validateVariableSchema } from "@/lib/prompt-variables";
import { fetchAllTestCaseInputs, prepareSuggestionVariableValues, uniqueGeneratedSuggestions } from "@/lib/test-cases";

const requestSchema = z.object({
  workspace_slug: z.string().min(1),
  project_id: z.string().uuid(),
  prompt_version_id: z.string().uuid()
});

export async function POST(request: Request) {
  try {
    const parsedRequest = requestSchema.safeParse(await request.json());
    if (!parsedRequest.success) {
      return NextResponse.json({ error: "Workspace, project, and selected prompt version are required." }, { status: 400 });
    }
    const { workspace_slug, project_id, prompt_version_id } = parsedRequest.data;
    const supabase = await createClient();
    const context = await getWorkspaceProject(supabase, workspace_slug, project_id);
    if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });

    const [{ data: prompt, error: promptError }, { data: criteria, error: criteriaError }, existingTestCaseInputs] = await Promise.all([
      supabase.from("prompt_versions").select("*").eq("id", prompt_version_id).eq("project_id", project_id).maybeSingle(),
      supabase.from("evaluation_criteria").select("*").eq("project_id", project_id).order("sort_order").order("created_at").order("id"),
      fetchAllTestCaseInputs(supabase, project_id)
    ]);
    if (promptError) throw promptError;
    if (criteriaError) throw criteriaError;
    if (!prompt) return NextResponse.json({ error: "Selected prompt version does not belong to this project." }, { status: 404 });

    const variableSchema = validateVariableSchema(prompt.variable_schema);
    const result = await runStructuredOutput({
      schemaName: "generated_test_cases",
      schema: generatedTestCasesSchemaForVariables(variableSchema),
      instructions:
        `You generate high-quality test cases for evaluating an AI application.

Generate exactly 10 realistic and meaningfully distinct test cases when possible, and never return more than 10.

Use the supplied project, selected prompt version, selected variable schema, evaluation criteria, and existing Golden Dataset inputs as context.

Cover a useful mix of normal, edge, ambiguous, missing_context, adversarial, and tone_sensitive cases. Do not force low-quality cases merely to satisfy equal distribution.

The complete variable schema is contextual information. Consider each variable's key, label, description, type, required status, configured options, and default_value when constructing realistic test cases. Default values provide additional product context; they are not mandatory values that must be copied into every test case.

variable_values may contain only keys defined in the selected variable schema. Values must respect their configured types and select options.

Do not reproduce, lightly reword, or create semantic duplicates of any existing Golden Dataset input. Do not create duplicates within the generated set.

Each rationale should briefly explain what behavior, risk, boundary, or evaluation criterion the test case exercises.

Return structured JSON only.`,
      input: JSON.stringify({
        project: context.project,
        selected_prompt: prompt,
        selected_variable_schema: variableSchema,
        evaluation_criteria: criteria,
        existing_test_case_inputs: existingTestCaseInputs
      }, null, 2)
    });

    const preparedSuggestions = result.test_cases.map((testCase) => ({
      ...testCase,
      user_input: testCase.user_input.trim(),
      variable_values: prepareSuggestionVariableValues(variableSchema, testCase.variable_values)
    }));

    return NextResponse.json({
      prompt_version_id: prompt.id,
      prompt_version_number: prompt.version_number,
      test_cases: uniqueGeneratedSuggestions(preparedSuggestions, existingTestCaseInputs, 10)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
