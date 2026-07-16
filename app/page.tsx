import Link from "next/link";
import { ArrowRight, CheckCircle2, FlaskConical, FolderKanban, PlusCircle, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-guard-bg text-white">
      <section className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-8 lg:px-8">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold">
            <span className="rounded-md bg-guard-cyan/15 p-2 text-guard-cyan"><ShieldCheck className="h-5 w-5" /></span>
            LaunchGuard
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/workspaces" className="rounded-md px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5">Explore Workspaces</Link>
            <Link href="/workspaces/new" className="rounded-md bg-guard-cyan px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">Create a Workspace</Link>
          </div>
        </div>
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:pb-20">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex rounded-full border border-guard-cyan/30 bg-guard-cyan/10 px-3 py-1 text-sm font-medium text-guard-cyan">
              Open, collaborative human evaluation
            </p>
            <h1 className="text-5xl font-semibold tracking-tight text-white lg:text-7xl">LaunchGuard</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              An open workspace for testing and improving AI prompts through golden datasets, structured human review, error analysis, and prompt iteration.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/workspaces" className="inline-flex items-center gap-2 rounded-md bg-guard-cyan px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                <FolderKanban className="h-4 w-4" /> Explore Workspaces <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/workspaces/new" className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                <PlusCircle className="h-4 w-4" /> Create a Workspace
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-glow">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="text-sm text-slate-400">Open evaluation workflow</p><p className="text-2xl font-semibold">Community Prompt Lab</p></div>
              <FlaskConical className="h-7 w-7 text-guard-cyan" />
            </div>
            <div className="space-y-3">
              {["Create an AI project", "Build a golden dataset", "Run AI outputs", "Complete human review", "Improve the prompt"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-md border border-white/10 bg-slate-950/35 p-4 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-guard-green" /> {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-10 lg:grid-cols-3 lg:px-8">
        {[
          ["Community Workspaces", "Browse public workspaces and the AI evaluation projects inside each one."],
          ["Structured QA", "Version prompts, define criteria, build test sets, and preserve generated output history."],
          ["Human-led improvement", "Score outputs, annotate failures, generate error analysis, and draft prompt vNext."]
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
