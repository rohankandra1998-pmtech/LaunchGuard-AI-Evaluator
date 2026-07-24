"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertUuid, assertWorkspaceSlug, getNextPromptVersionNumber, getWorkspace, projectPath, requireWorkspaceProject } from "@/lib/data";
import { parseJsonObject, ratingLabelToScore } from "@/lib/utils";
import { getProductModel, getReasoningModel } from "@/lib/openai";
import { revalidateProjectActivityPaths } from "@/lib/revalidation";
import { assertPromptPlaceholdersConfigured, parseSerializedVariableSchema, validateVariableSchema } from "@/lib/prompt-variables";
import { normalizeCriterionName, parseCriterionInput, type SuggestedCriterionInput } from "@/lib/criteria";
import { generatedTestCasesSchema, promptVNextSchema } from "@/lib/ai/schemas";
import { fetchAllTestCaseInputs, normalizeTestCaseInput, prepareSuggestionVariableValues, type PreparedGeneratedSuggestion } from "@/lib/test-cases";

const caseTypes = new Set(["normal", "edge", "ambiguous", "missing_context", "adversarial", "tone_sensitive"]);

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) || "");
}

function workspaceProjectFields(formData: FormData) {
  return {
    workspaceSlug: assertWorkspaceSlug(formString(formData, "workspace_slug")),
    projectId: assertUuid(formString(formData, "project_id"), "Project ID")
  };
}

function validateModel(value: string) {
  if (![getProductModel(), getReasoningModel()].includes(value)) throw new Error("Unsupported model.");
  return value;
}

export async function createWorkspace(formData: FormData) {
  const supabase = await createClient();
  const name = formString(formData, "name");
  if (!name) throw new Error("Workspace name is required.");

  const { data: workspace, error } = await supabase
    .from("workspaces")
    .insert({ name, description: formString(formData, "description") || null })
    .select("slug")
    .single();
  if (error) throw error;

  revalidatePath("/workspaces");
  redirect(`/workspaces/${workspace.slug}`);
}

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const workspaceSlug = assertWorkspaceSlug(formString(formData, "workspace_slug"));
  const workspaceId = assertUuid(formString(formData, "workspace_id"), "Workspace ID");
  const workspace = await getWorkspace(supabase, workspaceSlug);
  if (!workspace || workspace.id !== workspaceId) throw new Error("Workspace could not be validated.");

  const name = formString(formData, "name");
  const systemPrompt = formValue(formData, "system_prompt");
  if (!name) throw new Error("Project name is required.");
  if (!systemPrompt.trim()) throw new Error("Initial system prompt is required.");
  const model = validateModel(formString(formData, "model_used"));
  const variableSchema = parseSerializedVariableSchema(formString(formData, "variable_schema"));
  assertPromptPlaceholdersConfigured(systemPrompt, variableSchema);
  const variableKeys = variableSchema.map((variable) => variable.key);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspace.id,
      name,
      product_type: formString(formData, "product_type"),
      goal: formString(formData, "goal"),
      target_user: formString(formData, "target_user"),
      description: formString(formData, "description") || null,
      variables: variableKeys
    })
    .select("id")
    .single();
  if (projectError) throw projectError;

  const { error: promptError } = await supabase.from("prompt_versions").insert({
    project_id: project.id,
    version_number: 1,
    system_prompt: systemPrompt,
    variable_schema: variableSchema,
    model_used: model,
    notes: formString(formData, "notes") || "Initial prompt version",
    is_active: true
  });
  if (promptError) {
    await supabase.from("projects").delete().eq("id", project.id).eq("workspace_id", workspace.id);
    throw promptError;
  }

  revalidateProjectActivityPaths(workspace.slug, project.id, "/prompts");
  redirect(projectPath(workspace.slug, project.id));
}

export async function moveProjectToTrash(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  const workspace = await getWorkspace(supabase, workspaceSlug);
  if (!workspace) throw new Error("Workspace could not be validated.");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .is("trashed_at", null)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new Error("Project is unavailable or already in Trash.");

  const { data: movedProject, error } = await supabase
    .from("projects")
    .update({ trashed_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .is("trashed_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!movedProject) throw new Error("Project could not be moved to Trash.");

  revalidateProjectActivityPaths(workspaceSlug, projectId);
  redirect(`/workspaces/${workspaceSlug}`);
}

export async function restoreProject(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  const workspace = await getWorkspace(supabase, workspaceSlug);
  if (!workspace) throw new Error("Workspace could not be validated.");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .not("trashed_at", "is", null)
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new Error("Project is unavailable or already restored.");

  const { data: restoredProject, error } = await supabase
    .from("projects")
    .update({ trashed_at: null })
    .eq("id", projectId)
    .eq("workspace_id", workspace.id)
    .not("trashed_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!restoredProject) throw new Error("Project could not be restored.");

  revalidateProjectActivityPaths(workspaceSlug, projectId);
}

export async function updatePromptVersion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  const context = await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = assertUuid(formString(formData, "id"), "Prompt version ID");
  const systemPrompt = formValue(formData, "system_prompt");
  if (!systemPrompt.trim()) throw new Error("System prompt is required.");
  const variableSchema = parseSerializedVariableSchema(formString(formData, "variable_schema"));
  assertPromptPlaceholdersConfigured(systemPrompt, variableSchema);

  const { data: version, error: versionError } = await supabase
    .from("prompt_versions")
    .select("id, is_active")
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version) throw new Error("Prompt version does not belong to this project.");

  const { data, error } = await supabase
    .from("prompt_versions")
    .update({
      system_prompt: systemPrompt,
      notes: formString(formData, "notes") || null,
      model_used: validateModel(formString(formData, "model_used") || getProductModel()),
      variable_schema: variableSchema
    })
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Prompt version does not belong to this project.");
  if (version.is_active) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .update({ variables: variableSchema.map((variable) => variable.key) })
      .eq("id", projectId)
      .eq("workspace_id", context.workspace.id)
      .is("trashed_at", null)
      .select("id")
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) throw new Error("Active project variables could not be synchronized.");
  }
  const promptsPath = projectPath(workspaceSlug, projectId, "/prompts");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/prompts");
  redirect(promptsPath);
}

export async function createPromptVersion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const systemPrompt = formValue(formData, "system_prompt");
  if (!systemPrompt.trim()) throw new Error("System prompt is required.");
  const variableSchema = parseSerializedVariableSchema(formString(formData, "variable_schema"));
  assertPromptPlaceholdersConfigured(systemPrompt, variableSchema);

  const nextVersionNumber = await getNextPromptVersionNumber(supabase, projectId);

  const { error } = await supabase.from("prompt_versions").insert({
    project_id: projectId,
    version_number: nextVersionNumber,
    system_prompt: systemPrompt,
    variable_schema: variableSchema,
    model_used: validateModel(formString(formData, "model_used")),
    notes: formString(formData, "notes") || null,
    is_active: false
  });
  if (error) throw error;

  const promptsPath = projectPath(workspaceSlug, projectId, "/prompts");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/prompts");
  redirect(promptsPath);
}

export async function duplicatePromptVersion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = assertUuid(formString(formData, "id"), "Prompt version ID");

  const { data: source, error: sourceError } = await supabase.from("prompt_versions").select("*").eq("id", id).eq("project_id", projectId).maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw new Error("Prompt version does not belong to this project.");

  const nextVersionNumber = await getNextPromptVersionNumber(supabase, projectId);

  const { error } = await supabase.from("prompt_versions").insert({
    project_id: projectId,
    version_number: nextVersionNumber,
    system_prompt: source.system_prompt,
    variable_schema: validateVariableSchema(source.variable_schema),
    model_used: source.model_used,
    notes: `Duplicated from v${source.version_number}`,
    is_active: false
  });
  if (error) throw error;
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/prompts");
}

export async function deletePromptVersion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = assertUuid(formString(formData, "id"), "Prompt version ID");

  const { data: version, error: versionError } = await supabase
    .from("prompt_versions")
    .select("id, version_number, is_active")
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version) throw new Error("Prompt version does not belong to this project.");
  if (version.is_active) throw new Error(`Activate another prompt version before deleting v${version.version_number}.`);

  const { count: versionCount, error: countError } = await supabase
    .from("prompt_versions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (countError) throw countError;
  if (versionCount === null) throw new Error("Could not count prompt versions.");
  if (versionCount <= 1) throw new Error("A project must keep at least one prompt version.");

  const referenceResults = await Promise.all([
    supabase.from("test_cases").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("prompt_version_id", id),
    supabase.from("eval_runs").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("prompt_version_id", id),
    supabase.from("generated_outputs").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("prompt_version_id", id),
    supabase.from("error_analysis_reports").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("prompt_version_id", id)
  ]);
  for (const result of referenceResults) {
    if (result.error) throw result.error;
    if (result.count === null) throw new Error("Could not check prompt version evaluation history.");
  }
  if (referenceResults.some((result) => result.count! > 0)) {
    throw new Error(`v${version.version_number} has evaluation history and cannot be deleted.`);
  }

  const { data: deleted, error } = await supabase
    .from("prompt_versions")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!deleted) throw new Error("Prompt version could not be deleted.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/prompts");
}

export async function activatePromptVersion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  const context = await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = assertUuid(formString(formData, "id"), "Prompt version ID");
  const { data: version, error: versionError } = await supabase
    .from("prompt_versions")
    .select("id, variable_schema")
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (versionError) throw versionError;
  if (!version) throw new Error("Prompt version does not belong to this project.");
  const variableSchema = validateVariableSchema(version.variable_schema);

  const { error: deactivateError } = await supabase.from("prompt_versions").update({ is_active: false }).eq("project_id", projectId);
  if (deactivateError) throw deactivateError;
  const { error } = await supabase.from("prompt_versions").update({ is_active: true }).eq("id", id).eq("project_id", projectId);
  if (error) throw error;
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .update({ variables: variableSchema.map((variable) => variable.key) })
    .eq("id", projectId)
    .eq("workspace_id", context.workspace.id)
    .is("trashed_at", null)
    .select("id")
    .maybeSingle();
  if (projectError) throw projectError;
  if (!project) throw new Error("Active project variables could not be synchronized.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/prompts");
}

export async function saveCriterion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = formString(formData, "id");
  const payload = {
    project_id: projectId,
    name: formString(formData, "name"),
    description: formString(formData, "description"),
    good_definition: formString(formData, "good_definition"),
    average_definition: formString(formData, "average_definition"),
    bad_definition: formString(formData, "bad_definition"),
    category: formString(formData, "category") || null
  };
  if (!payload.name || !payload.description || !payload.good_definition || !payload.average_definition || !payload.bad_definition) {
    throw new Error("All criterion definitions are required.");
  }

  let result;
  if (id) {
    result = await supabase.from("evaluation_criteria").update(payload).eq("id", assertUuid(id, "Criterion ID")).eq("project_id", projectId).select("id").maybeSingle();
  } else {
    const { data: lastCriterion, error: orderError } = await supabase
      .from("evaluation_criteria")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (orderError) throw orderError;
    result = await supabase.from("evaluation_criteria").insert({ ...payload, sort_order: (lastCriterion?.sort_order ?? -1) + 1 }).select("id").single();
  }
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Criterion does not belong to this project.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/criteria", "/dataset");
}

export async function saveSuggestedCriteria(
  workspaceSlug: string,
  projectId: string,
  criteria: SuggestedCriterionInput[]
): Promise<{ insertedCount: number; skippedNames: string[] }> {
  const supabase = await createClient();
  const validatedWorkspaceSlug = assertWorkspaceSlug(workspaceSlug);
  const validatedProjectId = assertUuid(projectId, "Project ID");
  await requireWorkspaceProject(supabase, validatedWorkspaceSlug, validatedProjectId);
  if (!Array.isArray(criteria)) throw new Error("Suggested criteria must be an array.");
  if (criteria.length > 3) throw new Error("No more than three suggested criteria can be saved at once.");

  const validatedCriteria = criteria.map(parseCriterionInput);
  const { data: existingCriteria, error: existingError } = await supabase
    .from("evaluation_criteria")
    .select("name")
    .eq("project_id", validatedProjectId);
  if (existingError) throw existingError;

  const knownNames = new Set((existingCriteria || []).map((criterion) => normalizeCriterionName(criterion.name)));
  const submittedNames = new Set<string>();
  const skippedNames: string[] = [];
  const uniqueCriteria = validatedCriteria.filter((criterion) => {
    const normalizedName = normalizeCriterionName(criterion.name);
    if (knownNames.has(normalizedName) || submittedNames.has(normalizedName)) {
      skippedNames.push(criterion.name);
      return false;
    }
    submittedNames.add(normalizedName);
    return true;
  });

  if (!uniqueCriteria.length) return { insertedCount: 0, skippedNames };

  const orderResult = await supabase
    .from("evaluation_criteria")
    .select("sort_order")
    .eq("project_id", validatedProjectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (orderResult.error && orderResult.error.code !== "42703") throw orderResult.error;

  const nextSortOrder = (orderResult.data?.sort_order ?? -1) + 1;
  const rows = uniqueCriteria.map((criterion, index) => ({
    project_id: validatedProjectId,
    name: criterion.name,
    description: criterion.description,
    good_definition: criterion.good_definition,
    average_definition: criterion.average_definition,
    bad_definition: criterion.bad_definition,
    category: criterion.category || null,
    ...(orderResult.error?.code === "42703" ? {} : { sort_order: nextSortOrder + index })
  }));
  const { error: insertError } = await supabase.from("evaluation_criteria").insert(rows);
  if (insertError) throw insertError;

  revalidateProjectActivityPaths(validatedWorkspaceSlug, validatedProjectId, "/criteria", "/dataset");
  return { insertedCount: rows.length, skippedNames };
}

export async function reorderCriteria(workspaceSlug: string, projectId: string, orderedCriterionIds: string[]) {
  const supabase = await createClient();
  const validatedWorkspaceSlug = assertWorkspaceSlug(workspaceSlug);
  const validatedProjectId = assertUuid(projectId, "Project ID");
  await requireWorkspaceProject(supabase, validatedWorkspaceSlug, validatedProjectId);

  if (!Array.isArray(orderedCriterionIds)) throw new Error("Criterion order is required.");
  const validatedIds = orderedCriterionIds.map((id) => assertUuid(id, "Criterion ID"));
  if (new Set(validatedIds).size !== validatedIds.length) throw new Error("Criterion order cannot contain duplicates.");

  const { data: currentCriteria, error: criteriaError } = await supabase
    .from("evaluation_criteria")
    .select("id")
    .eq("project_id", validatedProjectId);
  if (criteriaError) throw criteriaError;

  const currentIds = (currentCriteria || []).map((criterion) => criterion.id);
  const submittedSet = new Set(validatedIds);
  if (validatedIds.length !== currentIds.length || currentIds.some((id) => !submittedSet.has(id))) {
    throw new Error("Criterion order must include every criterion in this project exactly once.");
  }

  const { error } = await supabase.rpc("reorder_evaluation_criteria", {
    p_project_id: validatedProjectId,
    p_ordered_ids: validatedIds
  });
  if (error) throw new Error(`Criterion order could not be saved: ${error.message}`);
  revalidateProjectActivityPaths(validatedWorkspaceSlug, validatedProjectId, "/criteria", "/dataset");
}

export async function deleteCriterion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = assertUuid(formString(formData, "id"), "Criterion ID");
  const { data, error } = await supabase.from("evaluation_criteria").delete().eq("id", id).eq("project_id", projectId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Criterion does not belong to this project.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/criteria", "/dataset");
}

export async function saveTestCase(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = formString(formData, "id");
  const caseType = formString(formData, "case_type") || "normal";
  if (!caseTypes.has(caseType)) throw new Error("Unsupported test case type.");
  const payload = {
    project_id: projectId,
    user_input: formString(formData, "user_input"),
    case_type: caseType,
    variable_values: parseJsonObject(formString(formData, "variable_values") || "{}"),
    status: "draft" as const
  };
  if (!payload.user_input) throw new Error("Test case input is required.");

  const testCaseId = id ? assertUuid(id, "Test case ID") : null;
  const result = testCaseId
    ? await supabase
        .from("test_cases")
        .update({ ...payload, generated_ai_output: null, prompt_version_id: null, model_used: null, variable_usage: {} })
        .eq("id", testCaseId)
        .eq("project_id", projectId)
        .select("id")
        .maybeSingle()
    : await supabase.from("test_cases").insert(payload).select("id").single();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Test case does not belong to this project.");
  if (testCaseId) {
    const { error: reviewError } = await supabase
      .from("human_reviews")
      .delete()
      .eq("test_case_id", testCaseId)
      .eq("project_id", projectId);
    if (reviewError) throw reviewError;
  }
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/dataset");
}

export async function saveGeneratedTestCases(workspaceSlug: string, projectId: string, promptVersionId: string, cases: PreparedGeneratedSuggestion[]) {
  const supabase = await createClient();
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const promptId = assertUuid(promptVersionId, "Prompt version ID");
  const parsedCases = generatedTestCasesSchema.safeParse({ test_cases: cases });
  if (!parsedCases.success || !parsedCases.data.test_cases.length) throw new Error("No valid generated test cases were supplied.");

  const [{ data: prompt, error: promptError }, existingInputs] = await Promise.all([
    supabase.from("prompt_versions").select("variable_schema").eq("id", promptId).eq("project_id", projectId).maybeSingle(),
    fetchAllTestCaseInputs(supabase, projectId)
  ]);
  if (promptError) throw promptError;
  if (!prompt) throw new Error("Selected prompt version does not belong to this project.");
  const variableSchema = validateVariableSchema(prompt.variable_schema);
  const seen = new Set(existingInputs.map(normalizeTestCaseInput).filter(Boolean));
  const rows: Array<{ project_id: string; user_input: string; case_type: string; variable_values: Record<string, string | number | boolean | null>; status: "draft" }> = [];
  let skippedDuplicateCount = 0;

  for (const [index, testCase] of parsedCases.data.test_cases.entries()) {
    const userInput = testCase.user_input.trim();
    const normalized = normalizeTestCaseInput(userInput);
    if (!normalized) throw new Error("Generated test cases must include a question.");
    if (seen.has(normalized)) {
      skippedDuplicateCount += 1;
      continue;
    }
    seen.add(normalized);
    rows.push({
      project_id: projectId,
      user_input: userInput,
      case_type: testCase.case_type,
      variable_values: prepareSuggestionVariableValues(variableSchema, cases[index]?.variable_values),
      status: "draft" as const
    });
  }

  if (!rows.length) throw new Error("No unique test cases remain to save. Remove or edit the duplicates and try again.");
  const { error } = await supabase.from("test_cases").insert(rows);
  if (error) throw error;
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/dataset");
  return { insertedCount: rows.length, skippedDuplicateCount };
}

export async function deleteTestCase(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = assertUuid(formString(formData, "id"), "Test case ID");
  const { data, error } = await supabase.from("test_cases").delete().eq("id", id).eq("project_id", projectId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Test case does not belong to this project.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/dataset");
}

export async function deleteErrorAnalysisReport(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const reportId = assertUuid(formString(formData, "report_id"), "Report ID");

  const { data, error } = await supabase
    .from("error_analysis_reports")
    .delete()
    .eq("id", reportId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Report could not be deleted. Please try again.");
  if (!data) throw new Error("Report does not belong to this project or was already deleted.");

  revalidateProjectActivityPaths(workspaceSlug, projectId, "/reports");
}

export async function saveHumanReview(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const testCaseId = assertUuid(formString(formData, "test_case_id"), "Test case ID");
  const { data: testCase, error: testCaseLookupError } = await supabase
    .from("test_cases")
    .select("id, generated_ai_output, status")
    .eq("id", testCaseId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (testCaseLookupError) throw testCaseLookupError;
  if (!testCase) throw new Error("Test case does not belong to this project.");
  if (!testCase.generated_ai_output || !["generated", "reviewed"].includes(testCase.status)) {
    throw new Error("Run this test case before saving a review.");
  }

  const ratingEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith("rating_"));
  const criterionIds = ratingEntries.map(([key]) => assertUuid(key.replace("rating_", ""), "Criterion ID"));
  if (new Set(criterionIds).size !== criterionIds.length) throw new Error("Each criterion can only be rated once.");
  const { data: criteria, error: criteriaError } = await supabase
    .from("evaluation_criteria")
    .select("id")
    .eq("project_id", projectId);
  if (criteriaError) throw criteriaError;
  const savedCriterionIds = new Set((criteria || []).map((criterion) => criterion.id));
  if (!savedCriterionIds.size) throw new Error("Add evaluation criteria before reviewing an output.");
  if (criterionIds.length !== savedCriterionIds.size || criterionIds.some((id) => !savedCriterionIds.has(id))) {
    throw new Error("Rate every saved evaluation criterion before marking this case as reviewed.");
  }
  const { data: review, error: reviewError } = await supabase
    .from("human_reviews")
    .upsert(
      {
        project_id: projectId,
        test_case_id: testCaseId,
        failure_category: null,
        severity: null,
        human_notes: formString(formData, "human_notes") || null,
        reviewed_at: new Date().toISOString()
      },
      { onConflict: "test_case_id" }
    )
    .select("id")
    .single();
  if (reviewError) throw reviewError;

  const { error: deleteError } = await supabase.from("human_review_ratings").delete().eq("review_id", review.id);
  if (deleteError) throw deleteError;
  const ratings = ratingEntries.map(([key, value]) => {
    const rating = String(value) as "Good" | "Average" | "Bad";
    if (!["Good", "Average", "Bad"].includes(rating)) throw new Error("Invalid human rating.");
    return {
      review_id: review.id,
      criterion_id: key.replace("rating_", ""),
      rating_label: rating,
      rating_score: ratingLabelToScore(rating)
    };
  });
  if (ratings.length) {
    const { error: ratingsError } = await supabase.from("human_review_ratings").insert(ratings);
    if (ratingsError) throw ratingsError;
  }

  const { error: testCaseError } = await supabase.from("test_cases").update({ status: "reviewed" }).eq("id", testCaseId).eq("project_id", projectId);
  if (testCaseError) throw testCaseError;
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/dataset");
}

export async function updatePromptProposalDraft(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const draftId = assertUuid(formString(formData, "draft_id"), "Prompt Proposal draft ID");
  const systemPrompt = formValue(formData, "system_prompt");
  if (!systemPrompt.trim()) throw new Error("The proposed system prompt cannot be empty.");

  const { data: draft, error: draftError } = await supabase
    .from("prompt_proposal_drafts")
    .select("id, source_prompt_version_id")
    .eq("id", draftId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (draftError) throw draftError;
  if (!draft) throw new Error("Prompt Proposal draft does not belong to this project.");

  const { data: sourcePrompt, error: promptError } = await supabase
    .from("prompt_versions")
    .select("variable_schema")
    .eq("id", draft.source_prompt_version_id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (promptError) throw promptError;
  if (!sourcePrompt) throw new Error("The source Prompt Version is no longer available.");
  const variableSchema = validateVariableSchema(sourcePrompt.variable_schema);
  assertPromptPlaceholdersConfigured(systemPrompt, variableSchema);

  const { data: updated, error: updateError } = await supabase
    .from("prompt_proposal_drafts")
    .update({ current_proposed_prompt: systemPrompt })
    .eq("id", draftId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!updated) throw new Error("Prompt Proposal draft could not be updated.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/reports");
}

export async function discardPromptProposalDraft(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const draftId = assertUuid(formString(formData, "draft_id"), "Prompt Proposal draft ID");

  const { data, error } = await supabase
    .from("prompt_proposal_drafts")
    .delete()
    .eq("id", draftId)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Prompt Proposal draft does not belong to this project or was already removed.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/reports");
}

export async function savePromptProposalAsVersion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const draftId = assertUuid(formString(formData, "draft_id"), "Prompt Proposal draft ID");

  const { data: draft, error: draftError } = await supabase
    .from("prompt_proposal_drafts")
    .select("id, source_prompt_version_id, proposal, current_proposed_prompt")
    .eq("id", draftId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (draftError) throw draftError;
  if (!draft) throw new Error("Prompt Proposal draft does not belong to this project.");

  promptVNextSchema.parse(draft.proposal);
  const systemPrompt = String(draft.current_proposed_prompt || "");
  if (!systemPrompt.trim()) throw new Error("The proposed system prompt cannot be empty.");
  const { data: sourcePrompt, error: promptError } = await supabase
    .from("prompt_versions")
    .select("variable_schema")
    .eq("id", draft.source_prompt_version_id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (promptError) throw promptError;
  if (!sourcePrompt) throw new Error("The source Prompt Version is no longer available.");
  const variableSchema = validateVariableSchema(sourcePrompt.variable_schema);
  assertPromptPlaceholdersConfigured(systemPrompt, variableSchema);

  const { data: savedVersion, error: saveError } = await supabase.rpc("save_prompt_proposal_as_version", {
    p_project_id: projectId,
    p_draft_id: draftId,
    p_model_used: getProductModel(),
    p_fallback_notes: "Draft created from error analysis"
  });
  if (saveError) throw saveError;
  if (!savedVersion?.length) throw new Error("The Prompt Proposal could not be saved as a Prompt Version.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/prompts", "/reports");
}
