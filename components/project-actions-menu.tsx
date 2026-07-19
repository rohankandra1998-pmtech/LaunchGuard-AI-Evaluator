"use client";

import { Ellipsis } from "lucide-react";
import { MoveProjectToTrashDialog } from "@/components/move-project-to-trash-dialog";

export function ProjectActionsMenu({ workspaceSlug, projectId, projectName }: { workspaceSlug: string; projectId: string; projectName: string }) {
  return (
    <details className="relative z-20">
      <summary className="focus-ring flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-guard-lineStrong bg-white text-guard-muted transition hover:bg-guard-primarySoft hover:text-guard-primary [&::-webkit-details-marker]:hidden">
        <span className="sr-only">Project actions for {projectName}</span>
        <Ellipsis className="h-5 w-5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-11 z-20 w-44 rounded-xl border border-guard-line bg-white p-1.5 shadow-floating">
        <MoveProjectToTrashDialog workspaceSlug={workspaceSlug} projectId={projectId} projectName={projectName} />
      </div>
    </details>
  );
}
