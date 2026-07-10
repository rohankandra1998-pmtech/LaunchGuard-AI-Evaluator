import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, LayoutDashboard, PlusCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-guard-bg">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-white/10 bg-slate-950/40 p-5 lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 text-lg font-semibold text-white">
          <span className="rounded-md bg-guard-cyan/15 p-2 text-guard-cyan">
            <ShieldCheck className="h-5 w-5" />
          </span>
          LaunchGuard
        </Link>
        <nav className="mt-10 space-y-2">
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/5" href="/dashboard">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-white/5" href="/projects/new">
            <PlusCircle className="h-4 w-4" />
            Create AI Project
          </Link>
        </nav>
        <form action={signOut} className="absolute bottom-5 left-5 right-5">
          <button className="w-full rounded-md border border-white/10 px-3 py-2 text-sm text-slate-300 hover:bg-white/5">Sign out</button>
        </form>
      </aside>
      <main className="px-4 py-6 lg:ml-64 lg:px-8">{children}</main>
    </div>
  );
}
