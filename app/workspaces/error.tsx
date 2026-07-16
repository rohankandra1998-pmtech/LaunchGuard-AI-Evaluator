"use client";

export default function WorkspacesError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-lg border border-guard-red/30 bg-guard-red/10 p-8">
      <h1 className="text-xl font-semibold text-white">The workspace directory could not be loaded.</h1>
      <p className="mt-2 text-sm text-slate-300">Check the Supabase environment variables and confirm the public workspace migration has been applied.</p>
      <button onClick={reset} className="mt-5 rounded-md bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15">Try again</button>
    </div>
  );
}
