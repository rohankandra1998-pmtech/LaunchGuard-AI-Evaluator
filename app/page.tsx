import Link from "next/link";
import { ArrowRight, CheckCircle2, FlaskConical, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-guard-bg text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-8 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:py-10">
          <div className="flex items-center gap-3 text-lg font-semibold">
            <span className="rounded-md bg-guard-cyan/15 p-2 text-guard-cyan">
              <ShieldCheck className="h-5 w-5" />
            </span>
            LaunchGuard
          </div>
          <div className="flex items-center justify-start gap-3 lg:justify-end">
            <Link href="/login" className="rounded-md px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5">
              Log in
            </Link>
            <Link href="/signup" className="rounded-md bg-guard-cyan px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
              Create Evaluation Project
            </Link>
          </div>
        </div>
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1fr_0.9fr] lg:px-8 lg:pb-20">
          <div className="max-w-3xl">
            <p className="mb-5 inline-flex rounded-full border border-guard-cyan/30 bg-guard-cyan/10 px-3 py-1 text-sm font-medium text-guard-cyan">
              Human evals for production-bound prompts
            </p>
            <h1 className="text-5xl font-semibold tracking-tight text-white lg:text-7xl">Test your AI prompts before launch.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              LaunchGuard helps AI builders create golden datasets, review AI outputs, annotate failures, and improve prompt versions through structured human evaluation.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-md bg-guard-cyan px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
                Create Evaluation Project
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="rounded-md border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">
                Open dashboard
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-glow">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Launch readiness</p>
                <p className="text-2xl font-semibold">Refund Bot Eval</p>
              </div>
              <FlaskConical className="h-7 w-7 text-guard-cyan" />
            </div>
            <div className="space-y-3">
              {["Golden Dataset", "Run AI Outputs", "Human Review", "Error Analysis", "Create Prompt vNext"].map((item, index) => (
                <div key={item} className="flex items-center justify-between rounded-md border border-white/10 bg-slate-950/35 p-4">
                  <span className="flex items-center gap-3 text-sm font-medium">
                    <CheckCircle2 className={index < 3 ? "h-4 w-4 text-guard-green" : "h-4 w-4 text-slate-500"} />
                    {item}
                  </span>
                  <span className="text-xs text-slate-400">{index < 3 ? "Ready" : "Next"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-4 px-6 py-10 lg:grid-cols-3 lg:px-8">
        {[
          ["Prompt lab", "Version system prompts, define Playground-style variables, and keep one active launch candidate."],
          ["QA dashboard", "Build golden datasets, run GPT-4.1 or GPT-5 outputs, and track review coverage."],
          ["Human evaluation", "Score criteria, annotate failures, summarize notes, and draft better prompt versions with GPT-5."]
        ].map(([title, body]) => (
          <div key={title} className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
