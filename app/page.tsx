import Link from "next/link";
import { ArrowRight, CheckCircle2, FlaskConical, FolderKanban, PlusCircle, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-guard-bg text-guard-text">
      <section className="border-b border-guard-line bg-gradient-to-b from-white to-guard-bg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-8 lg:px-8">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold">
            <span className="rounded-lg bg-guard-primarySoft p-2 text-guard-primary"><ShieldCheck className="h-5 w-5" /></span>
            LaunchGuard
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/workspaces" className="focus-ring rounded-lg px-4 py-2 text-sm font-medium text-guard-text hover:bg-guard-primarySoft">Explore Workspaces</Link>
            <Link href="/workspaces/new" className="focus-ring rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover">Create a Workspace</Link>
          </div>
        </div>
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:pb-20">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex rounded-full border border-guard-primaryLine bg-guard-primarySoft px-3 py-1 text-sm font-medium text-guard-primaryHover">
              Open, collaborative human evaluation
            </p>
            <h1 className="text-5xl font-semibold tracking-tight text-guard-ink lg:text-7xl">LaunchGuard</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-guard-muted">
              An open workspace for testing and improving AI prompts through golden datasets, structured human review, error analysis, and prompt iteration.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/workspaces" className="focus-ring inline-flex items-center gap-2 rounded-lg bg-guard-primary px-5 py-3 text-sm font-semibold text-white hover:bg-guard-primaryHover">
                <FolderKanban className="h-4 w-4" /> Explore Workspaces <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/workspaces/new" className="focus-ring inline-flex items-center gap-2 rounded-lg border border-guard-lineStrong bg-white px-5 py-3 text-sm font-semibold text-guard-primaryHover hover:bg-guard-primarySoft">
                <PlusCircle className="h-4 w-4" /> Create a Workspace
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-guard-line bg-white p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <div><p className="text-sm text-guard-muted">Open evaluation workflow</p><p className="text-2xl font-semibold text-guard-ink">Community Prompt Lab</p></div>
              <FlaskConical className="h-7 w-7 text-guard-primary" />
            </div>
            <div className="space-y-3">
              {["Create an AI project", "Build a golden dataset", "Run AI outputs", "Complete human review", "Improve the prompt"].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-lg border border-guard-line bg-guard-surfaceMuted p-4 text-sm font-medium text-guard-text">
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
          <div key={title} className="rounded-xl border border-guard-line bg-white p-5 shadow-card">
            <h2 className="text-lg font-semibold text-guard-ink">{title}</h2><p className="mt-2 text-sm leading-6 text-guard-muted">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
