import { NextResponse } from "next/server";
import { assertUuid, getWorkspaceProject } from "@/lib/data";
import { generateProductOutput, getProductModel, getReasoningModel } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { revalidateProjectActivityPaths } from "@/lib/revalidation";
import { compilePrompt, PromptVariableError, validateVariableSchema } from "@/lib/prompt-variables";

export async function POST(request: Request) {
  try {
    const { workspace_slug, project_id, test_case_ids, prompt_version_id, model } = await request.json();
    const selectedModel = model || getProductModel();
    if (![getProductModel(), getReasoningModel()].includes(selectedModel)) {
      return NextResponse.json({ error: "Unsupported model." }, { status: 400 });
    }

    const selectedIds = Array.isArray(test_case_ids)
      ? [...new Set(test_case_ids.map((id) => assertUuid(id, "Test case ID")))]
      : [];
    if (!selectedIds.length) return NextResponse.json({ error: "No test cases selected." }, { status: 400 });

    const supabase = await createClient();
    const context = await getWorkspaceProject(supabase, workspace_slug, project_id);
    if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });
    const promptId = assertUuid(prompt_version_id, "Prompt version ID");

    const [{ data: prompt, error: promptError }, { data: testCases, error: casesError }] = await Promise.all([
      supabase.from("prompt_versions").select("*").eq("id", promptId).eq("project_id", project_id).maybeSingle(),
      supabase.from("test_cases").select("*").eq("project_id", project_id).in("id", selectedIds)
    ]);
    if (promptError) throw promptError;
    if (casesError) throw casesError;
    if (!prompt) return NextResponse.json({ error: "Prompt version does not belong to this project." }, { status: 404 });
    if ((testCases || []).length !== selectedIds.length) {
      return NextResponse.json({ error: "One or more test cases do not belong to this project." }, { status: 400 });
    }

    const variableSchema = validateVariableSchema(prompt.variable_schema);
    const compiledCases = testCases!.map((testCase) => {
      const compilation = compilePrompt(
        prompt.system_prompt,
        variableSchema,
        testCase.variable_values && typeof testCase.variable_values === "object" && !Array.isArray(testCase.variable_values) ? testCase.variable_values : {}
      );
      return {
        testCase,
        systemPrompt: compilation.compiledPrompt,
        variableUsage: compilation.variableUsage
      };
    });

    const { data: run, error: runError } = await supabase
      .from("eval_runs")
      .insert({
        project_id,
        prompt_version_id: promptId,
        model_used: selectedModel,
        test_case_count: compiledCases.length
      })
      .select("id")
      .single();
    if (runError) throw runError;

    const results = [];
    for (const { testCase, systemPrompt, variableUsage } of compiledCases) {
      const output = await generateProductOutput({ systemPrompt, userInput: testCase.user_input, model: selectedModel });
      const { error: outputError } = await supabase.from("generated_outputs").insert({
        project_id,
        eval_run_id: run.id,
        test_case_id: testCase.id,
        prompt_version_id: promptId,
        model_used: selectedModel,
        output_text: output,
        variable_usage: variableUsage
      });
      if (outputError) throw outputError;

      const { error: testCaseError } = await supabase
        .from("test_cases")
        .update({ generated_ai_output: output, prompt_version_id: promptId, model_used: selectedModel, variable_usage: variableUsage })
        .eq("id", testCase.id)
        .eq("project_id", project_id);
      if (testCaseError) throw testCaseError;

      const { error: reviewError } = await supabase
        .from("human_reviews")
        .delete()
        .eq("test_case_id", testCase.id)
        .eq("project_id", project_id);
      if (reviewError) throw reviewError;

      const { error: statusError } = await supabase
        .from("test_cases")
        .update({ status: "generated" })
        .eq("id", testCase.id)
        .eq("project_id", project_id);
      if (statusError) throw statusError;
      results.push({ id: testCase.id, output });
    }

    revalidateProjectActivityPaths(workspace_slug, project_id, "/dataset");
    return NextResponse.json({ run_id: run.id, results });
  } catch (error) {
    const status = error instanceof PromptVariableError ? 400 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status });
  }
}
