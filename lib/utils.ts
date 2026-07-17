import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function parseVariables(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim().replace(/^\{+|\}+$/g, ""))
    .filter(Boolean);
}

export function parseJsonObject(value: string | null | undefined) {
  if (!value?.trim()) return {};
  const parsed = JSON.parse(value);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Expected a JSON object.");
  }
  return parsed as Record<string, string>;
}

export function ratingLabelToScore(label: string) {
  if (label === "Good") return 3;
  if (label === "Average") return 2;
  return 1;
}

export function todaySlug() {
  return new Date().toISOString().slice(0, 10);
}
