"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export function SubmitButton({
  children,
  pendingText = "Saving...",
  className = "",
  confirmMessage,
  disabled = false
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  confirmMessage?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      onClick={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) event.preventDefault();
      }}
      className={`focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-guard-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-guard-primaryHover disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 ${className}`}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {pending ? pendingText : children}
    </button>
  );
}
