import { z } from "zod";
import type { PromptVariable, VariableUsage, VariableUsageEntry } from "@/lib/types";

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

export type PromptSourceSegment =
  | { kind: "text"; text: string }
  | { kind: "placeholder"; text: string; key: string; status: "configured" | "unconfigured" | "malformed" };

export type CompiledPromptSegment =
  | { kind: "text"; text: string }
  | { kind: "variable"; text: string; key: string; label: string };

function pushTextSegment(segments: PromptSourceSegment[], text: string) {
  if (!text) return;
  const previous = segments.at(-1);
  if (previous?.kind === "text") previous.text += text;
  else segments.push({ kind: "text", text });
}

export function segmentPromptSource(prompt: string, variables: Pick<PromptVariable, "key">[] = []): PromptSourceSegment[] {
  const configured = new Set(variables.map((variable) => variable.key));
  const segments: PromptSourceSegment[] = [];
  let textStart = 0;
  let index = 0;

  while (index < prompt.length) {
    if (prompt.startsWith("{{", index)) {
      pushTextSegment(segments, prompt.slice(textStart, index));
      const closeIndex = prompt.indexOf("}}", index + 2);
      const end = closeIndex === -1 ? prompt.length : closeIndex + 2;
      const text = prompt.slice(index, end);
      const key = closeIndex === -1 ? "" : text.slice(2, -2).trim();
      const status = closeIndex !== -1 && PROMPT_VARIABLE_KEY_PATTERN.test(key)
        ? configured.has(key) ? "configured" as const : "unconfigured" as const
        : "malformed" as const;
      segments.push({ kind: "placeholder", text, key, status });
      index = end;
      textStart = end;
      continue;
    }

    if (prompt.startsWith("}}", index)) {
      pushTextSegment(segments, prompt.slice(textStart, index));
      segments.push({ kind: "placeholder", text: "}}", key: "", status: "malformed" });
      index += 2;
      textStart = index;
      continue;
    }

    if (prompt[index] === "{" && prompt[index + 1] !== "{" && prompt[index - 1] !== "{") {
      const closeIndex = prompt.indexOf("}", index + 1);
      if (closeIndex !== -1 && prompt[closeIndex + 1] !== "}") {
        const text = prompt.slice(index, closeIndex + 1);
        const key = text.slice(1, -1).trim();
        if (PROMPT_VARIABLE_KEY_PATTERN.test(key)) {
          pushTextSegment(segments, prompt.slice(textStart, index));
          segments.push({ kind: "placeholder", text, key, status: configured.has(key) ? "configured" : "unconfigured" });
          index = closeIndex + 1;
          textStart = index;
          continue;
        }
      }
    }

    index += 1;
  }

  pushTextSegment(segments, prompt.slice(textStart));
  return segments;
}

export function extractPromptPlaceholders(prompt: string) {
  return [...new Set(segmentPromptSource(prompt)
    .filter((segment): segment is Extract<PromptSourceSegment, { kind: "placeholder" }> => segment.kind === "placeholder" && segment.status !== "malformed")
    .map((segment) => segment.key))];
}

export function findMalformedPlaceholders(prompt: string) {
  return [...new Set(segmentPromptSource(prompt)
    .filter((segment) => segment.kind === "placeholder" && segment.status === "malformed")
    .map((segment) => segment.text === "}}" || !segment.text.endsWith("}}") ? "unmatched double braces" : segment.text))];
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

function variableUsageEntry(variable: PromptVariable, resolvedValue: string | number | boolean): VariableUsageEntry {
  const defaultValue = variable.default_value;
  const hasUsableDefault = defaultValue !== null && defaultValue !== "";

  if (!hasUsableDefault && resolvedValue === "") {
    return { source: "empty", value: null };
  }
  if (hasUsableDefault && Object.is(resolvedValue, defaultValue)) {
    return { source: "default", value: resolvedValue };
  }
  return { source: "override", value: resolvedValue };
}

export function valueToPromptString(value: string | number | boolean) {
  return typeof value === "boolean" ? (value ? "true" : "false") : String(value);
}

function resolveValidatedPromptVariableValues(variables: PromptVariable[], values: Record<string, unknown>) {
  const resolvedValues: Record<string, string | number | boolean> = {};
  const variableUsage: VariableUsage = {};

  for (const variable of variables) {
    const resolvedValue = typedValue(variable, values[variable.key]);
    resolvedValues[variable.key] = resolvedValue;
    variableUsage[variable.key] = variableUsageEntry(variable, resolvedValue);
  }

  return { resolvedValues, variableUsage };
}

export function resolvePromptVariableValues(variablesInput: unknown, values: Record<string, unknown>) {
  return resolveValidatedPromptVariableValues(validateVariableSchema(variablesInput), values);
}

function compileSegments(
  prompt: string,
  variables: PromptVariable[],
  resolvedValues: Record<string, string | number | boolean>
): CompiledPromptSegment[] {
  return segmentPromptSource(prompt, variables).map((segment): CompiledPromptSegment => {
    if (segment.kind === "text" || segment.status !== "configured" || !Object.hasOwn(resolvedValues, segment.key)) {
      return { kind: "text", text: segment.text };
    }
    const variable = variables.find((candidate) => candidate.key === segment.key)!;
    return {
      kind: "variable",
      text: valueToPromptString(resolvedValues[segment.key]),
      key: variable.key,
      label: variable.label
    };
  });
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
  const { resolvedValues, variableUsage } = resolveValidatedPromptVariableValues(variables, values);
  const segments = compileSegments(prompt, variables, resolvedValues);
  const compiledPrompt = segments.map((segment) => segment.text).join("");
  return { compiledPrompt, resolvedValues, variableUsage };
}

export function compilePromptPreview(prompt: string, variablesInput: unknown, values: Record<string, unknown>) {
  try {
    const variables = validateVariableSchema(variablesInput);
    const errors: string[] = [];
    const malformed = findMalformedPlaceholders(prompt);
    const unresolved = findUnconfiguredPlaceholders(prompt, variables);
    if (malformed.length) errors.push(`Malformed placeholders: ${malformed.join(", ")}.`);
    if (unresolved.length) errors.push(`Unconfigured variables: ${unresolved.join(", ")}.`);
    const resolvedValues: Record<string, string | number | boolean> = {};
    for (const variable of variables) {
      try {
        const value = typedValue(variable, values[variable.key]);
        resolvedValues[variable.key] = value;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `Could not resolve ${variable.label}.`);
      }
    }
    const segments = compileSegments(prompt, variables, resolvedValues);
    const compiledPrompt = segments.map((segment) => segment.text).join("");
    return { compiledPrompt, resolvedValues, errors, segments };
  } catch (error) {
    return {
      compiledPrompt: prompt,
      resolvedValues: {} as Record<string, string | number | boolean>,
      errors: [error instanceof Error ? error.message : "Prompt variables could not be compiled."],
      segments: [{ kind: "text" as const, text: prompt }]
    };
  }
}
