"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CopyState = "idle" | "copied" | "failed";

async function copyPlainText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  Object.assign(textarea.style, { position: "fixed", left: "-9999px", top: "0", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(textarea);
  try {
    textarea.focus();
    textarea.select();
    if (!document.execCommand("copy")) throw new Error("The browser did not copy the prompt.");
  } finally {
    textarea.remove();
    activeElement?.focus();
  }
}

export function CopyButton({ text, disabled = false, idleLabel = "Copy", successLabel = "Copied", className = "" }: { text: string; disabled?: boolean; idleLabel?: string; successLabel?: string; className?: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  async function copy() {
    if (disabled) return;
    if (resetTimer.current) clearTimeout(resetTimer.current);
    try {
      await copyPlainText(text);
      if (!mounted.current) return;
      setState("copied");
    } catch {
      if (!mounted.current) return;
      setState("failed");
    }
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      if (!mounted.current) return;
      setState("idle");
      resetTimer.current = null;
    }, 2000);
  }

  const label = state === "copied" ? successLabel : state === "failed" ? "Copy failed" : idleLabel;
  const Icon = state === "copied" ? Check : state === "failed" ? TriangleAlert : Copy;

  return (
    <>
      <button
        type="button"
        onClick={copy}
        disabled={disabled}
        aria-label={`${label} compiled prompt`}
        title={disabled ? "Resolve preview errors before copying the compiled prompt." : `${idleLabel} compiled prompt`}
        className={cn(
          "focus-ring inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:border-guard-line disabled:bg-slate-100 disabled:text-slate-400",
          state === "copied" ? "border-green-200 bg-guard-greenSoft text-guard-green" : state === "failed" ? "border-red-200 bg-guard-redSoft text-guard-red" : "border-guard-primaryLine bg-white text-guard-primaryHover hover:bg-guard-primarySoft",
          className
        )}
      >
        <Icon className="h-4 w-4" />{label}
      </button>
      <span className="sr-only" aria-live="polite">{state === "copied" ? "Compiled prompt copied to clipboard." : state === "failed" ? "The compiled prompt could not be copied." : ""}</span>
    </>
  );
}
