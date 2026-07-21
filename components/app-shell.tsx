import Link from "next/link";
import { FolderKanban, PlusCircle, ShieldCheck } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-guard-bg text-guard-text">
      <aside className="fixed inset-y-0 left-0 hidden w-48 border-r border-guard-line bg-white p-5 lg:block">
        <Link href="/" className="focus-ring flex items-center gap-3 rounded-lg text-lg font-semibold text-guard-ink">
          <span className="rounded-lg bg-guard-primarySoft p-2 text-guard-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          LaunchGuard
        </Link>
        <nav className="mt-10 space-y-2">
          <Link className="focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-guard-text hover:bg-guard-primarySoft hover:text-guard-primaryHover" href="/workspaces">
            <FolderKanban className="h-4 w-4" />
            Workspaces
          </Link>
          <Link className="focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-guard-text hover:bg-guard-primarySoft hover:text-guard-primaryHover" href="/workspaces/new">
            <PlusCircle className="h-4 w-4" />
            Create Workspace
          </Link>
        </nav>
        <p className="absolute bottom-5 left-5 right-5 border-t border-guard-line pt-4 text-xs leading-5 text-guard-muted">
          Open collaborative prototype. All workspace data is public.
        </p>
      </aside>
      <header className="flex items-center justify-between border-b border-guard-line bg-white px-4 py-3 lg:hidden">
        <Link href="/" className="focus-ring flex items-center gap-2 rounded-md font-semibold text-guard-ink">
          <ShieldCheck className="h-5 w-5 text-guard-primary" />
          LaunchGuard
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/workspaces" className="focus-ring rounded-md text-guard-text hover:text-guard-primary">Workspaces</Link>
          <Link href="/workspaces/new" aria-label="Create workspace" className="focus-ring rounded-md text-guard-primary"><PlusCircle className="h-5 w-5" /></Link>
        </nav>
      </header>
      <main className="px-4 py-6 lg:ml-48 lg:px-8">{children}</main>
    </div>
  );
}
