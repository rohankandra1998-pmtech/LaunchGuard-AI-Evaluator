import { TextArea } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { PromptVariableType } from "@/lib/types";

type TextVariableType = Extract<PromptVariableType, "text" | "long_text">;

export function textVariableSpansFullWidth(type: PromptVariableType, value: unknown) {
  return type === "long_text" || (type === "text" && typeof value === "string" && /[\r\n]/.test(value));
}

export function TextVariableTextArea({
  variableType,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { variableType: TextVariableType }) {
  const longText = variableType === "long_text";

  return (
    <TextArea
      {...props}
      rows={longText ? 8 : 3}
      className={cn("resize-y", longText ? "min-h-[12rem]" : "min-h-[5.5rem]", className)}
    />
  );
}
