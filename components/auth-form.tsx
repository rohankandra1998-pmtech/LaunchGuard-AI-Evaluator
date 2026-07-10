"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";
import { TextInput } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const supabase = createClient();

    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <TextInput required type="email" name="email" placeholder="you@company.com" />
      <TextInput required minLength={6} type="password" name="password" placeholder="Password" />
      {error ? <p className="rounded-md border border-guard-red/30 bg-guard-red/10 px-3 py-2 text-sm text-guard-red">{error}</p> : null}
      <button
        disabled={loading}
        className="focus-ring w-full rounded-md bg-guard-cyan px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
      >
        {loading ? "Working..." : mode === "login" ? "Log in" : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-400">
        {mode === "login" ? "New to LaunchGuard? " : "Already have an account? "}
        <Link className="font-medium text-guard-cyan" href={mode === "login" ? "/signup" : "/login"}>
          {mode === "login" ? "Sign up" : "Log in"}
        </Link>
      </p>
    </form>
  );
}
