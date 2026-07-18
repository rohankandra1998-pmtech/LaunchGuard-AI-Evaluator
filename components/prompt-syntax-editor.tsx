"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, type ChangeEvent, type TextareaHTMLAttributes, type UIEvent } from "react";
import { cn } from "@/lib/utils";
import { segmentPromptSource } from "@/lib/prompt-variables";
import type { PromptVariable } from "@/lib/types";

type PromptSyntaxEditorProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  variables: PromptVariable[];
};

export const PromptSyntaxEditor = forwardRef<HTMLTextAreaElement, PromptSyntaxEditorProps>(function PromptSyntaxEditor(
  { value, onChange, variables, className, placeholder, onScroll, ...props },
  forwardedRef
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLPreElement>(null);
  const segments = useMemo(() => segmentPromptSource(value, variables), [value, variables]);

  useImperativeHandle(forwardedRef, () => textareaRef.current!, []);

  function synchronizeScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (mirrorRef.current) {
      mirrorRef.current.scrollTop = event.currentTarget.scrollTop;
      mirrorRef.current.scrollLeft = event.currentTarget.scrollLeft;
    }
    onScroll?.(event);
  }

  return (
    <div className={cn("relative rounded-lg bg-guard-surfaceMuted", className)}>
      <pre
        ref={mirrorRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent p-4 font-mono text-sm leading-6 tracking-normal [overflow-wrap:anywhere] [tab-size:4]"
      >
        {value ? segments.map((segment, index) => {
          if (segment.kind === "text") return <span key={index} className="text-guard-ink">{segment.text}</span>;
          const tone = segment.status === "configured"
            ? "bg-guard-primarySoft text-guard-primaryHover"
            : segment.status === "unconfigured"
              ? "bg-guard-amberSoft text-guard-amber"
              : "bg-guard-redSoft text-guard-red";
          const label = segment.status === "configured" ? "Configured variable" : segment.status === "unconfigured" ? "Unconfigured variable" : "Malformed placeholder";
          return <mark key={index} title={`${label}: ${segment.key || segment.text}`} className={cn("rounded-sm", tone)}>{segment.text}</mark>;
        }) : <span className="text-guard-muted">{placeholder}</span>}
        {value.endsWith("\n") ? "\n" : null}
      </pre>
      <textarea
        {...props}
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={synchronizeScroll}
        placeholder={placeholder}
        className="focus-ring relative block min-h-96 w-full resize-y overflow-auto whitespace-pre-wrap break-words rounded-lg border border-guard-lineStrong bg-transparent p-4 font-mono text-sm leading-6 tracking-normal text-transparent caret-guard-ink placeholder:text-transparent hover:border-guard-primaryLine selection:bg-guard-primaryLine/70 selection:text-transparent [overflow-wrap:anywhere] [tab-size:4] disabled:cursor-not-allowed disabled:bg-slate-100"
      />
    </div>
  );
});
