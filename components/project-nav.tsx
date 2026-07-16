"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Beaker, ClipboardCheck, Database, FileText, LineChart, MessageSquareText, Sparkles } from "lucide-react";
import { projectPath } from "@/lib/data";
import { cn } from "@/lib/utils";

const items = [
  ["Overview", "", Beaker],
  ["Prompt Versions", "/prompts", MessageSquareText],
  ["Evaluation Criteria", "/criteria", ClipboardCheck],
  ["Golden Dataset", "/dataset", Database],
  ["Human Review", "/review", FileText],
  ["Results", "/results", LineChart],
  ["Error Analysis", "/reports", Sparkles]
] as const;

export function ProjectNav({ workspaceSlug, projectId }: { workspaceSlug: string; projectId: string }) {
  const pathname = usePathname();

  return (
    <div className="mb-6 overflow-x-auto border-b border-white/10">
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
                  ? "border-guard-cyan bg-guard-cyan/10 text-guard-cyan"
                  : "border-transparent text-slate-300 hover:bg-white/5 hover:text-white"
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
