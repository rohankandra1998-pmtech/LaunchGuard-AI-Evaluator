import type { SupabaseClient } from "@supabase/supabase-js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: unknown, label: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error(`${label} must be a valid UUID.`);
  }
  return value;
}

export function assertWorkspaceSlug(value: unknown) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("Workspace slug is invalid.");
  }
  return value;
}

export async function getWorkspace(supabase: SupabaseClient, workspaceSlug: string) {
  const slug = assertWorkspaceSlug(workspaceSlug);
  const { data, error } = await supabase.from("workspaces").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function getWorkspaceProject(supabase: SupabaseClient, workspaceSlug: string, projectId: string) {
  const workspace = await getWorkspace(supabase, workspaceSlug);
  if (!workspace) return null;

  const id = assertUuid(projectId, "Project ID");
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .is("trashed_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!project) return null;

  return { workspace, project };
}

export async function requireWorkspaceProject(supabase: SupabaseClient, workspaceSlug: string, projectId: string) {
  const context = await getWorkspaceProject(supabase, workspaceSlug, projectId);
  if (!context) throw new Error("Project was not found in this workspace.");
  return context;
}

export async function getNextPromptVersionNumber(supabase: SupabaseClient, projectId: string) {
  const id = assertUuid(projectId, "Project ID");
  const { data: latest, error } = await supabase
    .from("prompt_versions")
    .select("version_number")
    .eq("project_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (latest?.version_number ?? 0) + 1;
}

export function projectPath(workspaceSlug: string, projectId: string, suffix = "") {
  return `/workspaces/${workspaceSlug}/projects/${projectId}${suffix}`;
}
