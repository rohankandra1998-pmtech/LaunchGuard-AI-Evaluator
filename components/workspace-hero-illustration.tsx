import { BarChart3, FolderKanban, PieChart, Sparkles } from "lucide-react";

export function WorkspaceHeroIllustration() {
  return (
    <div aria-hidden="true" className="relative hidden h-44 w-80 shrink-0 md:block">
      <div className="absolute inset-x-4 top-8 h-28 rounded-[50%] border-[3px] border-guard-primaryLine/40" />
      <Sparkles className="absolute left-2 top-7 h-4 w-4 text-guard-primaryLine" />
      <Sparkles className="absolute right-4 top-32 h-5 w-5 text-guard-primaryLine" />
      <div className="absolute left-24 top-4 h-28 w-36 -rotate-6 rounded-2xl border border-guard-primaryLine bg-guard-primarySoft/90 shadow-card" />
      <div className="absolute left-14 top-10 flex h-28 w-44 rotate-3 items-center justify-center gap-4 rounded-2xl border border-guard-primaryLine bg-guard-surfaceStrong/90 text-guard-primary shadow-floating backdrop-blur">
        <FolderKanban className="absolute -top-5 left-10 h-12 w-12 opacity-35" />
        <BarChart3 className="h-14 w-14" strokeWidth={1.6} />
        <PieChart className="h-14 w-14" strokeWidth={1.6} />
      </div>
    </div>
  );
}
