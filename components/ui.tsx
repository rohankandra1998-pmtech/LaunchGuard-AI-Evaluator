import Link from "next/link";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-guard-line bg-guard-surface p-5 text-guard-text shadow-card", className)}>{children}</div>;
}

export function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "primary" | "good" | "average" | "bad" | "high" }) {
  const tones = {
    neutral: "border-guard-lineStrong bg-slate-100 text-slate-700",
    primary: "border-guard-primaryLine bg-guard-primarySoft text-guard-primaryHover",
    good: "border-green-200 bg-guard-greenSoft text-guard-green",
    average: "border-amber-200 bg-guard-amberSoft text-guard-amber",
    bad: "border-red-200 bg-guard-redSoft text-guard-red",
    high: "border-red-200 bg-guard-redSoft text-guard-red"
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
        {eyebrow ? <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-guard-primary">{eyebrow}</p> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-guard-ink">{title}</h1>
        {children ? <p className="mt-2 max-w-3xl text-sm leading-6 text-guard-muted">{children}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-guard-primaryLine bg-guard-surfaceMuted p-8 text-center">
      <h3 className="text-base font-semibold text-guard-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-guard-muted">{children}</p>
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("focus-ring w-full rounded-lg border border-guard-lineStrong bg-white px-3 py-2 text-sm text-guard-ink placeholder:text-guard-muted hover:border-guard-primaryLine disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500", props.className)} />;
}

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(props, ref) {
  return <textarea ref={ref} {...props} className={cn("focus-ring min-h-28 w-full rounded-lg border border-guard-lineStrong bg-white px-3 py-2 text-sm text-guard-ink placeholder:text-guard-muted hover:border-guard-primaryLine disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500", props.className)} />;
});

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("focus-ring w-full rounded-lg border border-guard-lineStrong bg-white px-3 py-2 text-sm text-guard-ink hover:border-guard-primaryLine disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500", props.className)} />;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-sm font-medium text-guard-text">{children}</label>;
}

export function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Card>
      <p className="text-sm text-guard-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-guard-ink">{value}</p>
      {detail ? <p className="mt-2 text-xs text-guard-muted">{detail}</p> : null}
    </Card>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link
      href={href as never}
      className={cn(
        "focus-ring inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition",
        variant === "primary" ? "bg-guard-primary text-white hover:bg-guard-primaryHover" : "border border-guard-lineStrong bg-white text-guard-primaryHover hover:border-guard-primaryLine hover:bg-guard-primarySoft"
      )}
    >
      {children}
    </Link>
  );
}
