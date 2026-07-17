import "server-only";

import { revalidatePath } from "next/cache";
import { projectPath } from "@/lib/data";

export function revalidateProjectActivityPaths(
  workspaceSlug: string,
  projectId: string,
  ...projectSectionPaths: string[]
) {
  const paths = new Set([
    "/workspaces",
    `/workspaces/${workspaceSlug}`,
    `/workspaces/${workspaceSlug}/trash`,
    projectPath(workspaceSlug, projectId),
    ...projectSectionPaths.map((sectionPath) => projectPath(workspaceSlug, projectId, sectionPath))
  ]);

  for (const path of paths) revalidatePath(path);
}
