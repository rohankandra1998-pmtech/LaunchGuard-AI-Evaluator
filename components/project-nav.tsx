import Link from "next/link";
import { Beaker, ClipboardCheck, Database, FileText, LineChart, MessageSquareText, Sparkles } from "lucide-react";
import { projectPath } from "@/lib/data";

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
  return (
    <div className="mb-6 overflow-x-auto border-b border-white/10">
      <nav className="flex min-w-max gap-2">
        {items.map(([label, path, Icon]) => (
          <Link
            key={label}
            href={projectPath(workspaceSlug, projectId, path)}
            className="flex items-center gap-2 rounded-t-md px-3 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
