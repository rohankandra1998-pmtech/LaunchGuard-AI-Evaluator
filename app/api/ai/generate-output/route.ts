import { NextResponse } from "next/server";
import { generateProductOutput, getProductModel, getReasoningModel } from "@/lib/openai";
import { createClient } from "@/lib/supabase/server";
import { interpolatePrompt } from "@/lib/utils";

export async function POST(request: Request) {
  try {
    const { project_id, test_case_ids, prompt_version_id, model } = await request.json();
    const selectedModel = model || getProductModel();
    if (![getProductModel(), getReasoningModel()].includes(selectedModel)) {
      return NextResponse.json({ error: "Unsupported model." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [{ data: prompt }, { data: testCases }] = await Promise.all([
      supabase.from("prompt_versions").select("*").eq("id", prompt_version_id).eq("project_id", project_id).eq("user_id", user.id).single(),
      supabase.from("test_cases").select("*").eq("project_id", project_id).eq("user_id", user.id).in("id", test_case_ids || [])
    ]);

    if (!prompt) return NextResponse.json({ error: "Prompt version not found." }, { status: 404 });
    if (!testCases?.length) return NextResponse.json({ error: "No test cases selected." }, { status: 400 });

    const { data: run, error: runError } = await supabase
      .from("eval_runs")
      .insert({
        user_id: user.id,
        project_id,
        prompt_version_id,
        model_used: selectedModel,
        test_case_count: testCases.length
      })
      .select("id")
      .single();
    if (runError) throw runError;

    const results = [];
    for (const testCase of testCases) {
      const systemPrompt = interpolatePrompt(prompt.system_prompt, testCase.variable_values || {});
      const output = await generateProductOutput({ systemPrompt, userInput: testCase.user_input, model: selectedModel });
      const { error: outputError } = await supabase.from("generated_outputs").insert({
        user_id: user.id,
        project_id,
        eval_run_id: run.id,
        test_case_id: testCase.id,
        prompt_version_id,
        model_used: selectedModel,
        output_text: output
      });
      if (outputError) throw outputError;
      const { error: testCaseError } = await supabase
        .from("test_cases")
        .update({
          generated_ai_output: output,
          prompt_version_id,
          model_used: selectedModel,
          status: "generated"
        })
        .eq("id", testCase.id)
        .eq("user_id", user.id);
      if (testCaseError) throw testCaseError;
      results.push({ id: testCase.id, output });
    }

    return NextResponse.json({ run_id: run.id, results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
