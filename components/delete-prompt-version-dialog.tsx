"use client";

import { useId, useRef } from "react";
import { Trash2 } from "lucide-react";
import { deletePromptVersion } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";

export function DeletePromptVersionDialog({
  workspaceSlug,
  projectId,
  versionId,
  versionNumber
}: {
  workspaceSlug: string;
  projectId: string;
  versionId: string;
  versionNumber: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-guard-red px-4 py-2 text-sm font-semibold text-white transition hover:bg-guard-red/80"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Delete
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
          <h2 id={titleId} className="text-xl font-semibold text-guard-ink">Delete prompt version?</h2>
          <p id={descriptionId} className="mt-2 text-sm leading-6 text-guard-muted">
            Delete v{versionNumber}? This permanently removes this unused draft and cannot be undone.
          </p>
          <form action={deletePromptVersion} className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <input type="hidden" name="workspace_slug" value={workspaceSlug} />
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="id" value={versionId} />
            <button
              type="button"
              autoFocus
              onClick={() => dialogRef.current?.close()}
              className="focus-ring inline-flex items-center justify-center rounded-lg border border-guard-lineStrong bg-white px-4 py-2 text-sm font-semibold text-guard-text transition hover:bg-guard-surfaceMuted"
            >
              Cancel
            </button>
            <SubmitButton className="!bg-guard-red !text-white hover:!bg-guard-red/80" pendingText="Deleting...">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete version
            </SubmitButton>
          </form>
        </div>
      </dialog>
    </>
  );
}
