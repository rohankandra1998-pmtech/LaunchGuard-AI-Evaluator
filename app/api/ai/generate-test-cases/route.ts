import { NextResponse } from "next/server";
import { z } from "zod";
import { generatedTestCasesSchemaForVariables } from "@/lib/ai/schemas";
import { getWorkspaceProject } from "@/lib/data";
import { runTestCaseStructuredOutput } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { validateVariableSchema } from "@/lib/prompt-variables";
import { fetchAllTestCaseInputs, prepareSuggestionVariableValues, uniqueGeneratedSuggestions } from "@/lib/test-cases";

const requestSchema = z.object({
  workspace_slug: z.string().min(1),
  project_id: z.string().uuid(),
  prompt_version_id: z.string().uuid()
});

export async function POST(request: Request) {
  const totalRequestStart = performance.now();
  let currentStage = "request_validation";

  try {
    const parsedRequest = requestSchema.safeParse(await request.json());
    if (!parsedRequest.success) {
      return NextResponse.json({ error: "Workspace, project, and selected prompt version are required." }, { status: 400 });
    }
    const { workspace_slug, project_id, prompt_version_id } = parsedRequest.data;
    const supabase = await createClient();

    currentStage = "workspace_lookup";
    const workspaceLookupStart = performance.now();
    const context = await getWorkspaceProject(supabase, workspace_slug, project_id);
    const workspaceLookupMs = Math.round(performance.now() - workspaceLookupStart);
    if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });

    currentStage = "database_context_queries";
    const databaseContextQueriesStart = performance.now();
    const [{ data: prompt, error: promptError }, { data: criteria, error: criteriaError }, existingTestCaseInputs] = await Promise.all([
      supabase
        .from("prompt_versions")
        .select("id, version_number, system_prompt, variable_schema")
        .eq("id", prompt_version_id)
        .eq("project_id", project_id)
        .maybeSingle(),
      supabase
        .from("evaluation_criteria")
        .select("name, description, category, good_definition, average_definition, bad_definition")
        .eq("project_id", project_id)
        .order("sort_order")
        .order("created_at")
        .order("id"),
      fetchAllTestCaseInputs(supabase, project_id)
    ]);
    const databaseContextQueriesMs = Math.round(performance.now() - databaseContextQueriesStart);
    if (promptError) throw promptError;
    if (criteriaError) throw criteriaError;
    if (!prompt) return NextResponse.json({ error: "Selected prompt version does not belong to this project." }, { status: 404 });

    const variableSchema = validateVariableSchema(prompt.variable_schema);

    currentStage = "openai_request";
    const openAIRequestStart = performance.now();
    const generationResult = await runTestCaseStructuredOutput({
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

Each rationale must be one concise sentence of no more than 180 characters, including spaces, explaining the behavior, risk, boundary, or evaluation criterion the test case exercises.

Return structured JSON only.`,
      input: JSON.stringify({
        project: {
          name: context.project.name,
          product_type: context.project.product_type,
          goal: context.project.goal,
          target_user: context.project.target_user,
          description: context.project.description
        },
        selected_prompt: {
          version_number: prompt.version_number,
          system_prompt: prompt.system_prompt
        },
        selected_variable_schema: variableSchema,
        evaluation_criteria: criteria,
        existing_test_case_inputs: existingTestCaseInputs
      }, null, 2)
    });
    const openAIRequestMs = Math.round(performance.now() - openAIRequestStart);
    const result = generationResult.output;

    currentStage = "post_processing";
    const postProcessingStart = performance.now();
    const preparedSuggestions = result.test_cases.map((testCase) => ({
      ...testCase,
      user_input: testCase.user_input.trim(),
      variable_values: prepareSuggestionVariableValues(variableSchema, testCase.variable_values)
    }));
    const testCases = uniqueGeneratedSuggestions(preparedSuggestions, existingTestCaseInputs, 10);
    const postProcessingMs = Math.round(performance.now() - postProcessingStart);

    const response = NextResponse.json({
      prompt_version_id: prompt.id,
      prompt_version_number: prompt.version_number,
      test_cases: testCases
    });

    console.info("[generate-test-cases] timing", {
      outcome: "success",
      workspaceLookupMs,
      databaseContextQueriesMs,
      openAIRequestMs,
      postProcessingMs,
      totalRequestMs: Math.round(performance.now() - totalRequestStart),
      existingInputCount: existingTestCaseInputs.length,
      generatedCaseCount: testCases.length,
      model: generationResult.model,
      input_tokens: generationResult.usage?.input_tokens ?? null,
      cached_tokens: generationResult.usage?.input_tokens_details?.cached_tokens ?? null,
      output_tokens: generationResult.usage?.output_tokens ?? null,
      reasoning_tokens: generationResult.usage?.output_tokens_details?.reasoning_tokens ?? null,
      total_tokens: generationResult.usage?.total_tokens ?? null
    });

    return response;
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error("[generate-test-cases] failed", {
      outcome: "failure",
      failedStage: currentStage,
      totalRequestMs: Math.round(performance.now() - totalRequestStart),
      errorName,
      errorMessage
    });

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
