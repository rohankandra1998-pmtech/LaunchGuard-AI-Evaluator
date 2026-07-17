import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceProject } from "@/lib/data";
import { generateProductOutput, getProductModel, getReasoningModel } from "@/lib/openai";
import { compilePrompt, PromptVariableError, validateVariableSchema } from "@/lib/prompt-variables";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  workspace_slug: z.string().min(1),
  project_id: z.string().uuid(),
  model: z.string().min(1),
  system_prompt: z.string().min(1, "System prompt is required.").max(50000),
  variable_schema: z.unknown(),
  variable_values: z.record(z.unknown()),
  user_input: z.string().trim().min(1, "A sample user message is required.").max(8000)
}).strict();

export async function POST(request: Request) {
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues.map((issue) => issue.message).join(" ") : "Request body must be valid JSON.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supportedModels = [getProductModel(), getReasoningModel()];
  if (!supportedModels.includes(body.model)) return NextResponse.json({ error: "Unsupported model." }, { status: 400 });

  const supabase = await createClient();
  const context = await getWorkspaceProject(supabase, body.workspace_slug, body.project_id);
  if (!context) return NextResponse.json({ error: "Project was not found in this workspace." }, { status: 404 });

  let compiledPrompt: string;
  try {
    const variableSchema = validateVariableSchema(body.variable_schema);
    compiledPrompt = compilePrompt(body.system_prompt, variableSchema, body.variable_values).compiledPrompt;
  } catch (error) {
    const message = error instanceof PromptVariableError ? error.message : "Prompt variables are invalid.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const output = await generateProductOutput({ systemPrompt: compiledPrompt, userInput: body.user_input, model: body.model });
    return NextResponse.json({ compiled_prompt: compiledPrompt, output });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The sandbox test failed." }, { status: 500 });
  }
}
