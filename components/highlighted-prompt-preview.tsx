import { cn } from "@/lib/utils";
import type { CompiledPromptSegment } from "@/lib/prompt-variables";

export function HighlightedPromptPreview({ segments, className = "", emptyText = "Your compiled prompt will appear here." }: { segments: CompiledPromptSegment[]; className?: string; emptyText?: string }) {
  const hasContent = segments.some((segment) => segment.text.length > 0);

  return (
    <pre className={cn("min-h-64 whitespace-pre-wrap break-words rounded-lg border border-guard-line bg-guard-surfaceMuted p-4 text-sm leading-6 text-guard-text [overflow-wrap:anywhere]", className)}>
      {hasContent ? segments.map((segment, index) => segment.kind === "variable"
        ? <span key={index} title={`Variable: ${segment.label}`} className="text-guard-primaryHover">{segment.text}</span>
        : <span key={index}>{segment.text}</span>) : <span className="text-guard-muted">{emptyText}</span>}
    </pre>
  );
}
