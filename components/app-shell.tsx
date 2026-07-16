import Link from "next/link";
import { FolderKanban, PlusCircle, ShieldCheck } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-guard-bg">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-slate-950/40 p-5 lg:block">
        <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-white">
          <span className="rounded-md bg-guard-cyan/15 p-2 text-guard-cyan">
            <ShieldCheck className="h-5 w-5" />
          </span>
          LaunchGuard
        </Link>
        <nav className="mt-10 space-y-2">
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/5" href="/workspaces">
            <FolderKanban className="h-4 w-4" />
            Workspaces
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/5" href="/workspaces/new">
            <PlusCircle className="h-4 w-4" />
            Create Workspace
          </Link>
        </nav>
        <p className="absolute bottom-5 left-5 right-5 text-xs leading-5 text-slate-500">
          Open collaborative prototype. All workspace data is public.
        </p>
      </aside>
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 lg:hidden">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <ShieldCheck className="h-5 w-5 text-guard-cyan" />
          LaunchGuard
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/workspaces" className="text-slate-200">Workspaces</Link>
          <Link href="/workspaces/new" aria-label="Create workspace" className="text-guard-cyan"><PlusCircle className="h-5 w-5" /></Link>
        </nav>
      </header>
      <main className="px-4 py-6 lg:ml-64 lg:px-8">{children}</main>
    </div>
  );
}
