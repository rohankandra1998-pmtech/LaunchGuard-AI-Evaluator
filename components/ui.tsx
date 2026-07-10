import Link from "next/link";
import { cn } from "@/lib/utils";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-lg border border-white/10 bg-white/[0.045] p-5 shadow-glow", className)}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "average" | "bad" | "high" | "cyan" }) {
  const tones = {
    neutral: "border-slate-500/30 bg-slate-400/10 text-slate-200",
    good: "border-guard-green/30 bg-guard-green/10 text-guard-green",
    average: "border-guard-amber/30 bg-guard-amber/10 text-guard-amber",
    bad: "border-guard-red/30 bg-guard-red/10 text-guard-red",
    high: "border-guard-red/30 bg-guard-red/10 text-guard-red",
    cyan: "border-guard-cyan/30 bg-guard-cyan/10 text-guard-cyan"
  };

  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-medium", tones[tone])}>{children}</span>;
}

export function PageHeader({
  title,
  eyebrow,
  actions,
  children
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow ? <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-guard-cyan">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
        {children ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{children}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-300">{children}</p>
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("focus-ring w-full rounded-md border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500", props.className)} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("focus-ring min-h-28 w-full rounded-md border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("focus-ring w-full rounded-md border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white", props.className)} />;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-slate-200">{children}</label>;
}

export function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-2 text-xs text-slate-400">{detail}</p> : null}
    </Card>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link
      href={href as never}
      className={cn(
        "focus-ring inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition",
        variant === "primary" ? "bg-guard-cyan text-slate-950 hover:bg-cyan-300" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
      )}
    >
      {children}
    </Link>
  );
}
