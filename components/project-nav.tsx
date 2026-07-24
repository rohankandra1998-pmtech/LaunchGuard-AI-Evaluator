"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Beaker, ClipboardCheck, Database, MessageSquareText, Sparkles } from "lucide-react";
import { projectPath } from "@/lib/data";
import { cn } from "@/lib/utils";

const items = [
  ["Overview", "", Beaker],
  ["Prompt Versions", "/prompts", MessageSquareText],
  ["Evaluation Criteria", "/criteria", ClipboardCheck],
  ["Golden Dataset", "/dataset", Database],
  ["Error Analysis", "/reports", Sparkles]
] as const;

export function ProjectNav({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 overflow-x-auto border-b border-guard-line">
      <nav className="flex min-w-max gap-2">
        {items.map(([label, path, Icon]) => {
          const href = projectPath(workspaceSlug, projectId, path);
          const isActive = path === "" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-t-md border-b-2 px-3 py-3 text-sm transition",
                isActive
                  ? "border-guard-primary bg-guard-primarySoft text-guard-primaryHover"
                  : "border-transparent text-guard-muted hover:bg-guard-surfaceMuted hover:text-guard-ink"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
