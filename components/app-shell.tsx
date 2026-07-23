import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-guard-bg text-guard-text">
      <header className="border-b border-guard-line bg-white px-4 py-3 lg:px-8">
        <Link href="/" className="focus-ring flex w-fit items-center gap-3 rounded-lg text-lg font-semibold text-guard-ink">
          <span className="rounded-lg bg-guard-primarySoft p-2 text-guard-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          LaunchGuard
        </Link>
      </header>
      <main className="px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
