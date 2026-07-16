"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertUuid, assertWorkspaceSlug, getNextPromptVersionNumber, getWorkspace, projectPath, requireWorkspaceProject } from "@/lib/data";
import { parseJsonObject, parseVariables, ratingLabelToScore } from "@/lib/utils";
import { getProductModel, getReasoningModel } from "@/lib/openai";
import { revalidateProjectActivityPaths } from "@/lib/revalidation";

const caseTypes = new Set(["normal", "edge", "ambiguous", "missing_context", "adversarial", "tone_sensitive"]);

function formString(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
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

async function assertRelatedRecord(
  table: string,
  id: string,
  projectId: string,
  label: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase.from(table).select("id").eq("id", assertUuid(id, `${label} ID`)).eq("project_id", projectId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`${label} does not belong to this project.`);
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

  const variables = parseVariables(formString(formData, "variables"));
  const name = formString(formData, "name");
  const systemPrompt = formString(formData, "system_prompt");
  if (!name || !systemPrompt) throw new Error("Project name and initial system prompt are required.");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      workspace_id: workspace.id,
      name,
      product_type: formString(formData, "product_type"),
      goal: formString(formData, "goal"),
      target_user: formString(formData, "target_user"),
      description: formString(formData, "description") || null,
      variables
    })
    .select("id")
    .single();
  if (projectError) throw projectError;

  const { error: promptError } = await supabase.from("prompt_versions").insert({
    project_id: project.id,
    version_number: 1,
    system_prompt: systemPrompt,
    model_used: getProductModel(),
    notes: "Initial prompt version",
    is_active: true
  });
  if (promptError) {
    await supabase.from("projects").delete().eq("id", project.id).eq("workspace_id", workspace.id);
    throw promptError;
  }

  revalidateProjectActivityPaths(workspace.slug, project.id, "/prompts");
  redirect(projectPath(workspace.slug, project.id));
}

export async function updatePromptVersion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = assertUuid(formString(formData, "id"), "Prompt version ID");

  const { data, error } = await supabase
    .from("prompt_versions")
    .update({
      system_prompt: formString(formData, "system_prompt"),
      notes: formString(formData, "notes") || null,
      model_used: validateModel(formString(formData, "model_used") || getProductModel())
    })
    .eq("id", id)
    .eq("project_id", projectId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Prompt version does not belong to this project.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/prompts");
}

export async function createPromptVersion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const systemPrompt = formString(formData, "system_prompt");
  if (!systemPrompt) throw new Error("System prompt is required.");

  const nextVersionNumber = await getNextPromptVersionNumber(supabase, projectId);

  const { error } = await supabase.from("prompt_versions").insert({
    project_id: projectId,
    version_number: nextVersionNumber,
    system_prompt: systemPrompt,
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
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = assertUuid(formString(formData, "id"), "Prompt version ID");
  await assertRelatedRecord("prompt_versions", id, projectId, "Prompt version");

  const { error: deactivateError } = await supabase.from("prompt_versions").update({ is_active: false }).eq("project_id", projectId);
  if (deactivateError) throw deactivateError;
  const { error } = await supabase.from("prompt_versions").update({ is_active: true }).eq("id", id).eq("project_id", projectId);
  if (error) throw error;
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

  const result = id
    ? await supabase.from("evaluation_criteria").update(payload).eq("id", assertUuid(id, "Criterion ID")).eq("project_id", projectId).select("id").maybeSingle()
    : await supabase.from("evaluation_criteria").insert(payload).select("id").single();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Criterion does not belong to this project.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/criteria");
}

export async function deleteCriterion(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const id = assertUuid(formString(formData, "id"), "Criterion ID");
  const { data, error } = await supabase.from("evaluation_criteria").delete().eq("id", id).eq("project_id", projectId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Criterion does not belong to this project.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/criteria");
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
    expected_answer: formString(formData, "expected_answer") || null,
    status: "draft"
  };
  if (!payload.user_input) throw new Error("Test case input is required.");

  const result = id
    ? await supabase.from("test_cases").update(payload).eq("id", assertUuid(id, "Test case ID")).eq("project_id", projectId).select("id").maybeSingle()
    : await supabase.from("test_cases").insert(payload).select("id").single();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Test case does not belong to this project.");
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/dataset");
}

export async function saveGeneratedTestCases(workspaceSlug: string, projectId: string, cases: Array<Record<string, unknown>>) {
  const supabase = await createClient();
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  if (!cases.length) throw new Error("No generated test cases were supplied.");
  const rows = cases.map((testCase) => {
    const caseType = String(testCase.case_type || "normal");
    if (!caseTypes.has(caseType)) throw new Error("Generated test case contains an unsupported case type.");
    return {
      project_id: projectId,
      user_input: String(testCase.user_input || "").trim(),
      case_type: caseType,
      variable_values: testCase.variable_values || {},
      expected_answer: testCase.expected_answer ? String(testCase.expected_answer) : null,
      status: "draft"
    };
  });
  if (rows.some((row) => !row.user_input)) throw new Error("Generated test cases must include user input.");
  const { error } = await supabase.from("test_cases").insert(rows);
  if (error) throw error;
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/dataset");
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

export async function saveHumanReview(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const testCaseId = assertUuid(formString(formData, "test_case_id"), "Test case ID");
  await assertRelatedRecord("test_cases", testCaseId, projectId, "Test case");

  const ratingEntries = Array.from(formData.entries()).filter(([key]) => key.startsWith("rating_"));
  const criterionIds = ratingEntries.map(([key]) => assertUuid(key.replace("rating_", ""), "Criterion ID"));
  const { data: criteria, error: criteriaError } = criterionIds.length
    ? await supabase.from("evaluation_criteria").select("id").eq("project_id", projectId).in("id", criterionIds)
    : { data: [], error: null };
  if (criteriaError) throw criteriaError;
  if ((criteria || []).length !== new Set(criterionIds).size) throw new Error("One or more ratings reference criteria outside this project.");

  const { data: review, error: reviewError } = await supabase
    .from("human_reviews")
    .upsert(
      {
        project_id: projectId,
        test_case_id: testCaseId,
        failure_category: formString(formData, "failure_category") || null,
        severity: formString(formData, "severity") || null,
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
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/review", "/results");
}

export async function savePromptDraft(formData: FormData) {
  const supabase = await createClient();
  const { workspaceSlug, projectId } = workspaceProjectFields(formData);
  await requireWorkspaceProject(supabase, workspaceSlug, projectId);
  const systemPrompt = formString(formData, "system_prompt");
  if (!systemPrompt) throw new Error("Improved system prompt is required.");

  const { data: latest, error: latestError } = await supabase
    .from("prompt_versions")
    .select("version_number")
    .eq("project_id", projectId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  if (latestError) throw latestError;

  const { error } = await supabase.from("prompt_versions").insert({
    project_id: projectId,
    version_number: latest.version_number + 1,
    system_prompt: systemPrompt,
    model_used: getProductModel(),
    notes: formString(formData, "change_summary") || "Draft created from error analysis",
    is_active: false
  });
  if (error) throw error;
  revalidateProjectActivityPaths(workspaceSlug, projectId, "/prompts", "/reports");
}
