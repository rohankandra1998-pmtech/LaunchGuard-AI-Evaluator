"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Inbox, LayoutGrid, List, Search, X } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { WorkspaceCard, type WorkspaceViewModel } from "@/components/workspace-card";
import { cn } from "@/lib/utils";

type SortOption = "recent" | "oldest" | "name-asc" | "name-desc" | "projects" | "test-cases" | "reviewed";

export function WorkspacesDirectory({ workspaces }: { workspaces: WorkspaceViewModel[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [shortcut, setShortcut] = useState("Ctrl K");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setShortcut(navigator.platform.toLowerCase().includes("mac") ? "⌘ K" : "Ctrl K");
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isFormField = target?.matches("input, textarea, select, [contenteditable='true']");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !isFormField) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleWorkspaces = useMemo(() => {
    const filtered = workspaces.filter((workspace) =>
      `${workspace.name} ${workspace.description}`.toLocaleLowerCase().includes(normalizedQuery)
    );
    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "oldest": return Date.parse(a.updatedAt) - Date.parse(b.updatedAt);
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "projects": return b.projectCount - a.projectCount;
        case "test-cases": return b.testCaseCount - a.testCaseCount;
        case "reviewed": return b.reviewedCount - a.reviewedCount;
        default: return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
      }
    });
  }, [normalizedQuery, sort, workspaces]);

  if (workspaces.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-guard-primaryLine bg-guard-surface p-10 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-guard-primarySoft text-guard-primary">
          <Inbox aria-hidden="true" className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-guard-ink">No workspaces yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-guard-muted">Create your first workspace to organize projects, test cases, and collaborative reviews.</p>
        <ButtonLink href="/workspaces/new"><span className="mt-1">Create Workspace</span></ButtonLink>
      </section>
    );
  }

  return (
    <>
      <section aria-label="Workspace controls" className="rounded-xl border border-guard-line bg-guard-surface p-4 shadow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative block min-w-0 md:max-w-sm md:flex-1">
            <span className="sr-only">Search workspaces</span>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-guard-muted" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workspaces..."
              className="focus-ring h-11 w-full rounded-lg border border-guard-lineStrong bg-white pl-10 pr-20 text-sm text-guard-ink placeholder:text-guard-muted hover:border-guard-primaryLine"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded bg-guard-surfaceMuted px-2 py-1 text-[11px] text-guard-muted">{shortcut}</kbd>
          </label>
          <label className="flex h-11 items-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-3 text-sm text-guard-muted md:min-w-56">
            <span className="shrink-0">Sort by:</span>
            <select
              aria-label="Sort workspaces"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="focus-ring min-w-0 flex-1 bg-transparent font-medium text-guard-text"
            >
              <option value="recent">Recently updated</option>
              <option value="oldest">Oldest updated</option>
              <option value="name-asc">Name A–Z</option>
              <option value="name-desc">Name Z–A</option>
              <option value="projects">Most projects</option>
              <option value="test-cases">Most test cases</option>
              <option value="reviewed">Most reviewed</option>
            </select>
          </label>
          <div className="flex gap-1 md:ml-auto" aria-label="Workspace view">
            {(["grid", "list"] as const).map((option) => {
              const Icon = option === "grid" ? LayoutGrid : List;
              return (
                <button
                  key={option}
                  type="button"
                  aria-label={`Show workspaces in ${option} view`}
                  aria-pressed={view === option}
                  onClick={() => setView(option)}
                  className={cn("focus-ring flex h-11 w-11 items-center justify-center rounded-lg border text-guard-muted", view === option ? "border-guard-primaryLine bg-guard-primarySoft text-guard-primary shadow-sm" : "border-transparent hover:bg-guard-surfaceMuted")}
                >
                  <Icon aria-hidden="true" className="h-5 w-5" />
                  <span className="sr-only">{view === option ? "Selected" : ""}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {visibleWorkspaces.length ? (
        <section
          aria-label="Workspaces"
          className={cn("mt-4", view === "grid" ? "grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]" : "space-y-3")}
        >
          {visibleWorkspaces.map((workspace) => <WorkspaceCard key={workspace.id} workspace={workspace} view={view} />)}
        </section>
      ) : (
        <section className="mt-4 rounded-xl border border-dashed border-guard-primaryLine bg-guard-surface p-10 text-center">
          <Search aria-hidden="true" className="mx-auto h-7 w-7 text-guard-primary" />
          <h2 className="mt-3 text-lg font-semibold text-guard-ink">No matching workspaces</h2>
          <p className="mt-2 text-sm text-guard-muted">Try a different name or description, or clear your search to see every workspace.</p>
          <button type="button" onClick={() => setQuery("")} className="focus-ring mt-4 inline-flex items-center gap-2 rounded-md border border-guard-primaryLine px-4 py-2 text-sm font-semibold text-guard-primary hover:bg-guard-primarySoft">
            <X aria-hidden="true" className="h-4 w-4" /> Clear search
          </button>
        </section>
      )}

      <aside className="mx-auto mt-8 flex w-fit items-center gap-3 text-left">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-guard-primarySoft text-guard-primary">
          <Inbox aria-hidden="true" className="h-5 w-5" />
        </span>
        <p className="text-sm">
          <strong className="block font-semibold text-guard-ink">Can’t find what you’re looking for?</strong>
          <Link href="/workspaces/new" className="focus-ring mt-0.5 inline-block rounded text-guard-muted underline-offset-4 hover:text-guard-primary hover:underline">Create a new workspace</Link>
          <span className="text-guard-muted"> to get started.</span>
        </p>
      </aside>
    </>
  );
}
