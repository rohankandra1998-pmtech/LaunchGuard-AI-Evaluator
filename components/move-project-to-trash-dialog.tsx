"use client";

import { useId, useRef } from "react";
import { Trash2 } from "lucide-react";
import { moveProjectToTrash } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { PROJECT_TRASH_RETENTION_DAYS } from "@/lib/project-trash";
import { cn } from "@/lib/utils";

export function MoveProjectToTrashDialog({
  workspaceSlug,
  projectId,
  projectName,
  triggerClassName
}: {
  workspaceSlug: string;
  projectId: string;
  projectName: string;
  triggerClassName?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={cn(
          "focus-ring flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-guard-red transition hover:bg-guard-redSoft",
          triggerClassName
        )}
      >
        <Trash2 className="h-4 w-4 text-guard-red" aria-hidden="true" />
        Move to Trash
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dialogRef.current?.close();
          }
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-guard-line bg-white p-0 text-left text-guard-text shadow-floating backdrop:bg-slate-900/35 backdrop:backdrop-blur-sm"
      >
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-guard-red/15 text-guard-red">
            <Trash2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 id={titleId} className="text-xl font-semibold text-guard-ink">Move {projectName} to Trash?</h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-guard-muted">
            This project will be hidden from the workspace and permanently deleted after {PROJECT_TRASH_RETENTION_DAYS} days. You can restore it before then.
          </p>
          <form action={moveProjectToTrash} className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <input type="hidden" name="workspace_slug" value={workspaceSlug} />
            <input type="hidden" name="project_id" value={projectId} />
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              className="focus-ring inline-flex items-center justify-center rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text transition hover:bg-guard-surfaceMuted"
            >
              Cancel
            </button>
            <SubmitButton className="!bg-guard-red !text-white hover:!bg-guard-red/80" pendingText="Moving to Trash...">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Move to Trash
            </SubmitButton>
          </form>
        </div>
      </dialog>
    </>
  );
}
