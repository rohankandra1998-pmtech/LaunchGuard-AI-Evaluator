"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseJsonObject, parseVariables, ratingLabelToScore } from "@/lib/utils";
import { getProductModel } from "@/lib/openai";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createProject(formData: FormData) {
  const { supabase, user } = await requireUser();
  const variables = parseVariables(String(formData.get("variables") || ""));
  const name = String(formData.get("name") || "").trim();
  const systemPrompt = String(formData.get("system_prompt") || "").trim();

  if (!name || !systemPrompt) throw new Error("Project name and initial system prompt are required.");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      product_type: String(formData.get("product_type") || "").trim(),
      goal: String(formData.get("goal") || "").trim(),
      target_user: String(formData.get("target_user") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      variables
    })
    .select("id")
    .single();

  if (projectError) throw projectError;

  const { error: promptError } = await supabase.from("prompt_versions").insert({
    user_id: user.id,
    project_id: project.id,
    version_number: 1,
    system_prompt: systemPrompt,
    model_used: getProductModel(),
    notes: "Initial prompt version",
    is_active: true
  });

  if (promptError) throw promptError;
  redirect(`/projects/${project.id}`);
}

export async function updatePromptVersion(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));

  const { error } = await supabase
    .from("prompt_versions")
    .update({
      system_prompt: String(formData.get("system_prompt") || ""),
      notes: String(formData.get("notes") || ""),
      model_used: String(formData.get("model_used") || getProductModel())
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
  revalidatePath(`/projects/${projectId}/prompts`);
}

export async function duplicatePromptVersion(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));

  const { data: source, error: sourceError } = await supabase
    .from("prompt_versions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (sourceError) throw sourceError;

  const { data: latest } = await supabase
    .from("prompt_versions")
    .select("version_number")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  const { error } = await supabase.from("prompt_versions").insert({
    user_id: user.id,
    project_id: projectId,
    version_number: (latest?.version_number || 1) + 1,
    system_prompt: source.system_prompt,
    model_used: source.model_used,
    notes: `Duplicated from v${source.version_number}`,
    is_active: false
  });

  if (error) throw error;
  revalidatePath(`/projects/${projectId}/prompts`);
}

export async function activatePromptVersion(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));

  await supabase.from("prompt_versions").update({ is_active: false }).eq("project_id", projectId).eq("user_id", user.id);
  const { error } = await supabase.from("prompt_versions").update({ is_active: true }).eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath(`/projects/${projectId}/prompts`);
}

export async function saveCriterion(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("project_id"));
  const payload = {
    user_id: user.id,
    project_id: projectId,
    name: String(formData.get("name") || "").trim(),
    description: String(formData.get("description") || "").trim(),
    good_definition: String(formData.get("good_definition") || "").trim(),
    average_definition: String(formData.get("average_definition") || "").trim(),
    bad_definition: String(formData.get("bad_definition") || "").trim(),
    category: String(formData.get("category") || "").trim() || null
  };

  const result = id
    ? await supabase.from("evaluation_criteria").update(payload).eq("id", id).eq("user_id", user.id)
    : await supabase.from("evaluation_criteria").insert(payload);

  if (result.error) throw result.error;
  revalidatePath(`/projects/${projectId}/criteria`);
}

export async function deleteCriterion(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));
  const { error } = await supabase.from("evaluation_criteria").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath(`/projects/${projectId}/criteria`);
}

export async function saveTestCase(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("project_id"));
  const payload = {
    user_id: user.id,
    project_id: projectId,
    user_input: String(formData.get("user_input") || "").trim(),
    case_type: String(formData.get("case_type") || "normal"),
    variable_values: parseJsonObject(String(formData.get("variable_values") || "{}")),
    expected_answer: String(formData.get("expected_answer") || "").trim() || null,
    status: "draft"
  };

  const result = id
    ? await supabase.from("test_cases").update(payload).eq("id", id).eq("user_id", user.id)
    : await supabase.from("test_cases").insert(payload);

  if (result.error) throw result.error;
  revalidatePath(`/projects/${projectId}/dataset`);
}

export async function saveGeneratedTestCases(projectId: string, cases: Array<Record<string, unknown>>) {
  const { supabase, user } = await requireUser();
  const rows = cases.map((testCase) => ({
    user_id: user.id,
    project_id: projectId,
    user_input: String(testCase.user_input || ""),
    case_type: String(testCase.case_type || "normal"),
    variable_values: testCase.variable_values || {},
    expected_answer: testCase.expected_answer ? String(testCase.expected_answer) : null,
    status: "draft"
  }));
  const { error } = await supabase.from("test_cases").insert(rows);
  if (error) throw error;
  revalidatePath(`/projects/${projectId}/dataset`);
}

export async function deleteTestCase(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const projectId = String(formData.get("project_id"));
  const { error } = await supabase.from("test_cases").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
  revalidatePath(`/projects/${projectId}/dataset`);
}

export async function saveHumanReview(formData: FormData) {
  const { supabase, user } = await requireUser();
  const projectId = String(formData.get("project_id"));
  const testCaseId = String(formData.get("test_case_id"));

  const { data: review, error: reviewError } = await supabase
    .from("human_reviews")
    .upsert(
      {
        user_id: user.id,
        project_id: projectId,
        test_case_id: testCaseId,
        failure_category: String(formData.get("failure_category") || "").trim() || null,
        severity: String(formData.get("severity") || "") || null,
        human_notes: String(formData.get("human_notes") || "").trim() || null,
        reviewed_at: new Date().toISOString()
      },
      { onConflict: "test_case_id" }
    )
    .select("id")
    .single();

  if (reviewError) throw reviewError;

  await supabase.from("human_review_ratings").delete().eq("review_id", review.id).eq("user_id", user.id);

  const ratings = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("rating_"))
    .map(([key, value]) => {
      const rating = String(value) as "Good" | "Average" | "Bad";
      return {
        user_id: user.id,
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

  const { error: testCaseError } = await supabase.from("test_cases").update({ status: "reviewed" }).eq("id", testCaseId).eq("user_id", user.id);
  if (testCaseError) throw testCaseError;
  revalidatePath(`/projects/${projectId}/review`);
  revalidatePath(`/projects/${projectId}/results`);
}

export async function savePromptDraft(formData: FormData) {
  const { supabase, user } = await requireUser();
  const projectId = String(formData.get("project_id"));
  const systemPrompt = String(formData.get("system_prompt") || "").trim();
  const changeSummary = String(formData.get("change_summary") || "").trim();

  const { data: latest } = await supabase
    .from("prompt_versions")
    .select("version_number")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  const { error } = await supabase.from("prompt_versions").insert({
    user_id: user.id,
    project_id: projectId,
    version_number: (latest?.version_number || 1) + 1,
    system_prompt: systemPrompt,
    model_used: getProductModel(),
    notes: changeSummary || "Draft created from error analysis",
    is_active: false
  });

  if (error) throw error;
  revalidatePath(`/projects/${projectId}/prompts`);
  revalidatePath(`/projects/${projectId}/reports`);
}
