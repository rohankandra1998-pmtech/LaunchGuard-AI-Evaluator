import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";
import { getOpenAIEnv } from "@/lib/env";

function getClient() {
  const { apiKey } = getOpenAIEnv();
  return new OpenAI({ apiKey });
}

export function getProductModel() {
  return process.env.OPENAI_PRODUCT_MODEL || "gpt-4.1";
}

export function getReasoningModel() {
  return process.env.OPENAI_REASONING_MODEL || "gpt-5";
}

export async function runStructuredOutput<TSchema extends z.ZodTypeAny>(options: {
  schemaName: string;
  schema: TSchema;
  instructions: string;
  input: string;
}) {
  const client = getClient();
  const response = await client.responses.parse({
    model: getReasoningModel(),
    input: [
      { role: "developer", content: options.instructions },
      { role: "user", content: options.input }
    ],
    text: {
      format: zodTextFormat(options.schema, options.schemaName)
    }
  });

  if (!response.output_parsed) {
    throw new Error("The AI response did not match the expected schema.");
  }

  return response.output_parsed as z.infer<TSchema>;
}

export async function generateProductOutput(options: {
  systemPrompt: string;
  userInput: string;
  model?: string;
}) {
  const client = getClient();
  const model = options.model || getProductModel();

  if (![getProductModel(), getReasoningModel()].includes(model)) {
    throw new Error("Unsupported model. Use OPENAI_PRODUCT_MODEL or OPENAI_REASONING_MODEL only.");
  }

  const response = await client.responses.create({
    model,
    input: [
      { role: "developer", content: options.systemPrompt },
      { role: "user", content: options.userInput }
    ]
  });

  return response.output_text;
}
