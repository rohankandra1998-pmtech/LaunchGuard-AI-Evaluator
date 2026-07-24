import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-guard-bg text-guard-text">
      <header className="h-16 border-b border-guard-line bg-white px-4 lg:px-8">
        <div className="flex h-full items-stretch">
          <Link href="/" className="focus-ring my-auto flex items-center gap-2.5 rounded-lg pr-4 text-lg font-semibold tracking-tight text-guard-ink sm:pr-6">
            <ShieldCheck aria-hidden="true" className="h-7 w-7 text-guard-primary" />
            <span>LaunchGuard</span>
          </Link>
          <span aria-hidden="true" className="my-4 w-px bg-guard-line" />
          <nav aria-label="Primary navigation" className="ml-2 flex items-stretch sm:ml-3">
            <Link
              href="/workspaces"
              aria-current="page"
              className="focus-ring relative flex items-center rounded-t-md px-3 text-sm font-semibold text-guard-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-guard-primary"
            >
              Workspaces
            </Link>
          </nav>
        </div>
      </header>
      <main className="px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
