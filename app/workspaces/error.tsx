"use client";

export default function WorkspacesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-guard-red/30 bg-guard-red/10 p-8">
      <h1 className="text-xl font-semibold text-guard-ink">The workspace directory could not be loaded.</h1>
      <p className="mt-2 text-sm text-guard-muted">Check the Supabase environment variables and confirm the public workspace migration has been applied.</p>
      <button onClick={reset} className="focus-ring mt-5 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white hover:bg-guard-primaryHover">Try again</button>
    </div>
  );
}
