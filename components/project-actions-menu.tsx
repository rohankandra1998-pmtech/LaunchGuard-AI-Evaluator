"use client";

import { Ellipsis } from "lucide-react";
import { MoveProjectToTrashDialog } from "@/components/move-project-to-trash-dialog";

export function ProjectActionsMenu({ workspaceSlug, projectId, projectName }: { workspaceSlug: string; projectId: string; projectName: string }) {
  return (
    <details className="relative z-20">
      <summary className="focus-ring flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md border border-white/10 bg-slate-950/70 text-slate-300 transition hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden">
        <span className="sr-only">Project actions for {projectName}</span>
        <Ellipsis className="h-5 w-5" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 top-11 w-44 rounded-lg border border-white/10 bg-guard-panel p-1.5 shadow-2xl">
        <MoveProjectToTrashDialog workspaceSlug={workspaceSlug} projectId={projectId} projectName={projectName} />
      </div>
    </details>
  );
}
