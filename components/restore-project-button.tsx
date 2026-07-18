import { RotateCcw } from "lucide-react";
import { restoreProject } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function RestoreProjectButton({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) {
  return (
    <form action={restoreProject}>
      <input type="hidden" name="workspace_slug" value={workspaceSlug} />
      <input type="hidden" name="project_id" value={projectId} />
      <SubmitButton pendingText="Restoring...">
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Restore
      </SubmitButton>
    </form>
  );
}
