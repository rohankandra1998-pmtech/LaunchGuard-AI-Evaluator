import { z } from "zod";
import type { PromptVariable } from "@/lib/types";

export const PROMPT_VARIABLE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export const promptVariableSchema = z
  .object({
    key: z.string().min(1, "Variable name is required.").max(50, "Variable names must be 50 characters or fewer.").regex(PROMPT_VARIABLE_KEY_PATTERN, "Use lowercase letters, numbers, and underscores, starting with a letter."),
    label: z.string().min(1, "Display label is required.").max(100, "Display labels must be 100 characters or fewer.").refine((label) => label.trim().length > 0, "Display label is required."),
    type: z.enum(["text", "long_text", "number", "boolean", "select"]),
    required: z.boolean(),
    default_value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    description: z.string().max(250, "Descriptions must be 250 characters or fewer.").nullable(),
    options: z.array(z.string().min(1, "Select options cannot be empty.").max(100, "Select options must be 100 characters or fewer.").refine((option) => option.trim().length > 0, "Select options cannot be empty."))
  })
  .strict()
  .superRefine((variable, context) => {
    const duplicateOptions = variable.options.filter((option, index) => variable.options.indexOf(option) !== index);
    if (duplicateOptions.length) context.addIssue({ code: "custom", path: ["options"], message: "Select options must be unique." });

    if (variable.type === "select") {
      if (!variable.options.length) context.addIssue({ code: "custom", path: ["options"], message: "Select variables need at least one option." });
      if (variable.default_value !== null && (typeof variable.default_value !== "string" || !variable.options.includes(variable.default_value))) {
        context.addIssue({ code: "custom", path: ["default_value"], message: "The default must match a select option." });
      }
    } else if (variable.options.length) {
      context.addIssue({ code: "custom", path: ["options"], message: "Only select variables may define options." });
    }

    if (["text", "long_text"].includes(variable.type) && variable.default_value !== null && typeof variable.default_value !== "string") {
      context.addIssue({ code: "custom", path: ["default_value"], message: "Text defaults must be text." });
    }
    if (variable.type === "number" && variable.default_value !== null && (typeof variable.default_value !== "number" || !Number.isFinite(variable.default_value))) {
      context.addIssue({ code: "custom", path: ["default_value"], message: "Number defaults must be valid numbers." });
    }
    if (variable.type === "boolean" && variable.default_value !== null && typeof variable.default_value !== "boolean") {
      context.addIssue({ code: "custom", path: ["default_value"], message: "Boolean defaults must be true, false, or empty." });
    }
  });

export const promptVariableArraySchema = z.array(promptVariableSchema).superRefine((variables, context) => {
  const seen = new Set<string>();
  variables.forEach((variable, index) => {
    if (seen.has(variable.key)) context.addIssue({ code: "custom", path: [index, "key"], message: `Variable name "${variable.key}" is duplicated.` });
    seen.add(variable.key);
  });
});

export class PromptVariableError extends Error {
  constructor(message: string, public details: string[] = []) {
    super(message);
    this.name = "PromptVariableError";
  }
}

function formatZodError(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.length ? `${issue.path.join(".")}: ` : ""}${issue.message}`);
}

export function validateVariableSchema(value: unknown): PromptVariable[] {
  const result = promptVariableArraySchema.safeParse(value);
  if (!result.success) {
    const details = formatZodError(result.error);
    throw new PromptVariableError(`Variable configuration is invalid: ${details.join(" ")}`, details);
  }
  return result.data;
}

export function parseSerializedVariableSchema(value: string | null | undefined) {
  if (!value?.trim()) throw new PromptVariableError("Variable configuration is required.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new PromptVariableError("Variable configuration must be valid JSON.");
  }
  return validateVariableSchema(parsed);
}

export function variableLabelFromKey(key: string) {
  return key.split("_").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function legacyVariablesToSchema(keys: string[]): PromptVariable[] {
  return validateVariableSchema(keys.map((key) => ({
    key,
    label: variableLabelFromKey(key),
    type: "text" as const,
    required: false,
    default_value: null,
    description: null,
    options: []
  })));
}

const doubleBracePattern = /{{\s*([a-z][a-z0-9_]*)\s*}}/g;
const legacyBracePattern = /(^|[^{]){\s*([a-z][a-z0-9_]*)\s*}(?!})/g;
const doubleBraceCandidatePattern = /{{\s*([^{}]*?)\s*}}/g;

export function extractPromptPlaceholders(prompt: string) {
  const keys: string[] = [];
  for (const match of prompt.matchAll(doubleBracePattern)) keys.push(match[1]);
  for (const match of prompt.matchAll(legacyBracePattern)) keys.push(match[2]);
  return [...new Set(keys)];
}

export function findMalformedPlaceholders(prompt: string) {
  const malformed: string[] = [];
  for (const match of prompt.matchAll(doubleBraceCandidatePattern)) {
    const candidate = match[1].trim();
    if (!PROMPT_VARIABLE_KEY_PATTERN.test(candidate)) malformed.push(match[0]);
  }
  const unmatched = prompt.replace(doubleBraceCandidatePattern, "");
  if (unmatched.includes("{{") || unmatched.includes("}}")) malformed.push("unmatched double braces");
  return [...new Set(malformed)];
}

export function findDuplicateVariableKeys(variables: PromptVariable[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const variable of variables) {
    if (seen.has(variable.key)) duplicates.add(variable.key);
    seen.add(variable.key);
  }
  return [...duplicates];
}

export function findUnconfiguredPlaceholders(prompt: string, variables: PromptVariable[]) {
  const configured = new Set(variables.map((variable) => variable.key));
  return extractPromptPlaceholders(prompt).filter((key) => !configured.has(key));
}

export function findUnusedVariables(prompt: string, variables: PromptVariable[]) {
  const used = new Set(extractPromptPlaceholders(prompt));
  return variables.filter((variable) => !used.has(variable.key)).map((variable) => variable.key);
}

function typedValue(variable: PromptVariable, rawValue: unknown) {
  const hasValue = rawValue !== undefined && rawValue !== null && (typeof rawValue !== "string" || rawValue.trim() !== "");
  const value = hasValue ? rawValue : variable.default_value;
  if (value === undefined || value === null || value === "") {
    if (variable.required) throw new PromptVariableError(`A value is required for ${variable.label}.`, [variable.key]);
    return "";
  }

  if (variable.type === "number") {
    const numberValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numberValue)) throw new PromptVariableError(`${variable.label} must be a valid number.`, [variable.key]);
    return numberValue;
  }
  if (variable.type === "boolean") {
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    throw new PromptVariableError(`${variable.label} must be true or false.`, [variable.key]);
  }
  if (typeof value !== "string") throw new PromptVariableError(`${variable.label} must be text.`, [variable.key]);
  if (variable.type === "select" && !variable.options.includes(value)) {
    throw new PromptVariableError(`${variable.label} must match one of its configured options.`, [variable.key]);
  }
  return value;
}

export function valueToPromptString(value: string | number | boolean) {
  return typeof value === "boolean" ? (value ? "true" : "false") : String(value);
}

export function resolvePromptVariableValues(variablesInput: unknown, values: Record<string, unknown>) {
  const variables = validateVariableSchema(variablesInput);
  return Object.fromEntries(variables.map((variable) => [variable.key, typedValue(variable, values[variable.key])]));
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replacePromptVariable(prompt: string, keyValue: string, replacement: string) {
  const key = escapeRegex(keyValue);
  return prompt
    .replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), () => replacement)
    .replace(new RegExp(`(^|[^{]){\\s*${key}\\s*}(?!})`, "g"), (_match, prefix: string) => `${prefix}${replacement}`);
}

export function assertPromptPlaceholdersConfigured(prompt: string, variablesInput: unknown) {
  const variables = validateVariableSchema(variablesInput);
  const malformed = findMalformedPlaceholders(prompt);
  if (malformed.length) throw new PromptVariableError(`Malformed placeholders: ${malformed.join(", ")}. Use {{variable_name}}.`, malformed);
  const unresolved = findUnconfiguredPlaceholders(prompt, variables);
  if (unresolved.length) throw new PromptVariableError(`Configure these prompt variables before continuing: ${unresolved.join(", ")}.`, unresolved);
  return variables;
}

export function compilePrompt(prompt: string, variablesInput: unknown, values: Record<string, unknown>) {
  const variables = assertPromptPlaceholdersConfigured(prompt, variablesInput);
  const resolvedValues = resolvePromptVariableValues(variables, values);
  let compiledPrompt = prompt;
  for (const variable of variables) {
    const replacement = valueToPromptString(resolvedValues[variable.key]);
    compiledPrompt = replacePromptVariable(compiledPrompt, variable.key, replacement);
  }
  return { compiledPrompt, resolvedValues };
}

export function compilePromptPreview(prompt: string, variablesInput: unknown, values: Record<string, unknown>) {
  try {
    const variables = validateVariableSchema(variablesInput);
    const errors: string[] = [];
    const malformed = findMalformedPlaceholders(prompt);
    const unresolved = findUnconfiguredPlaceholders(prompt, variables);
    if (malformed.length) errors.push(`Malformed placeholders: ${malformed.join(", ")}.`);
    if (unresolved.length) errors.push(`Unconfigured variables: ${unresolved.join(", ")}.`);
    let compiledPrompt = prompt;
    const resolvedValues: Record<string, string | number | boolean> = {};
    for (const variable of variables) {
      try {
        const value = typedValue(variable, values[variable.key]);
        resolvedValues[variable.key] = value;
        compiledPrompt = replacePromptVariable(compiledPrompt, variable.key, valueToPromptString(value));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Could not resolve ${variable.label}.`);
      }
    }
    return { compiledPrompt, resolvedValues, errors };
  } catch (error) {
    return {
      compiledPrompt: prompt,
      resolvedValues: {} as Record<string, string | number | boolean>,
      errors: [error instanceof Error ? error.message : "Prompt variables could not be compiled."]
    };
  }
}
