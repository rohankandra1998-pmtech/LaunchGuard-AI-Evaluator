import type { PromptVNextResponse } from "@/lib/ai/schemas";

export type PromptDiffLine = {
  key: string;
  beforeLineNumber: number | null;
  afterLineNumber: number | null;
  beforeText: string | null;
  afterText: string | null;
  beforeKind: "unchanged" | "removed" | "placeholder";
  afterKind: "unchanged" | "added" | "placeholder";
  annotationIds: string[];
};

type Operation = { kind: "equal" | "delete" | "insert"; text: string };
type LineRange = { start: number; end: number };

export function createPromptDiff(
  before: string,
  after: string,
  annotations: PromptVNextResponse["change_annotations"]
): PromptDiffLine[] {
  const beforeLines = splitLines(before);
  const afterLines = splitLines(after);
  const operations = diffLines(beforeLines, afterLines);
  const matches = annotations.map((annotation) => ({
    id: annotation.change_id,
    before: findExcerptRange(before, annotation.before_text),
    after: findExcerptRange(after, annotation.after_text)
  }));
  const rows: PromptDiffLine[] = [];
  let beforeNumber = 1;
  let afterNumber = 1;
  let index = 0;

  while (index < operations.length) {
    const operation = operations[index];
    if (operation.kind === "equal") {
      rows.push(makeRow(operation.text, operation.text, "unchanged", "unchanged"));
      index += 1;
      beforeNumber += 1;
      afterNumber += 1;
      continue;
    }

    const deleted: string[] = [];
    const inserted: string[] = [];
    while (index < operations.length && operations[index].kind !== "equal") {
      const change = operations[index];
      if (change.kind === "delete") deleted.push(change.text);
      else inserted.push(change.text);
      index += 1;
    }

    for (let offset = 0; offset < Math.max(deleted.length, inserted.length); offset += 1) {
      const beforeText = deleted[offset] ?? null;
      const afterText = inserted[offset] ?? null;
      rows.push(makeRow(
        beforeText,
        afterText,
        beforeText === null ? "placeholder" : "removed",
        afterText === null ? "placeholder" : "added"
      ));
      if (beforeText !== null) beforeNumber += 1;
      if (afterText !== null) afterNumber += 1;
    }
  }

  function makeRow(
    beforeText: string | null,
    afterText: string | null,
    beforeKind: PromptDiffLine["beforeKind"],
    afterKind: PromptDiffLine["afterKind"]
  ): PromptDiffLine {
    const currentBefore = beforeText === null ? null : beforeNumber;
    const currentAfter = afterText === null ? null : afterNumber;
    const annotationIds = matches
      .filter((match) => inRange(currentBefore, match.before) || inRange(currentAfter, match.after))
      .map((match) => match.id);
    return {
      key: `${rows.length}-${currentBefore ?? "x"}-${currentAfter ?? "x"}`,
      beforeLineNumber: currentBefore,
      afterLineNumber: currentAfter,
      beforeText,
      afterText,
      beforeKind,
      afterKind,
      annotationIds
    };
  }

  return rows;
}

function splitLines(value: string) {
  return value.replace(/\r\n/g, "\n").split("\n");
}

function diffLines(before: string[], after: string[]): Operation[] {
  if (before.length * after.length > 2_000_000) {
    return diffLargeLineSets(before, after);
  }
  const lengths = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1));
  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      lengths[left][right] = before[left] === after[right]
        ? lengths[left + 1][right + 1] + 1
        : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
    }
  }

  const operations: Operation[] = [];
  let left = 0;
  let right = 0;
  while (left < before.length && right < after.length) {
    if (before[left] === after[right]) {
      operations.push({ kind: "equal", text: before[left] });
      left += 1;
      right += 1;
    } else if (lengths[left + 1][right] >= lengths[left][right + 1]) {
      operations.push({ kind: "delete", text: before[left] });
      left += 1;
    } else {
      operations.push({ kind: "insert", text: after[right] });
      right += 1;
    }
  }
  while (left < before.length) operations.push({ kind: "delete", text: before[left++] });
  while (right < after.length) operations.push({ kind: "insert", text: after[right++] });
  return operations;
}

function diffLargeLineSets(before: string[], after: string[]): Operation[] {
  let prefixLength = 0;
  while (
    prefixLength < before.length
    && prefixLength < after.length
    && before[prefixLength] === after[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < before.length - prefixLength
    && suffixLength < after.length - prefixLength
    && before[before.length - suffixLength - 1] === after[after.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  return [
    ...before.slice(0, prefixLength).map((text) => ({ kind: "equal" as const, text })),
    ...before.slice(prefixLength, before.length - suffixLength).map((text) => ({ kind: "delete" as const, text })),
    ...after.slice(prefixLength, after.length - suffixLength).map((text) => ({ kind: "insert" as const, text })),
    ...before.slice(before.length - suffixLength).map((text) => ({ kind: "equal" as const, text }))
  ];
}

function findExcerptRange(prompt: string, excerpt: string | null): LineRange | null {
  if (!excerpt) return null;
  const normalizedPrompt = prompt.replace(/\r\n/g, "\n");
  const normalizedExcerpt = excerpt.replace(/\r\n/g, "\n");
  const characterIndex = normalizedPrompt.indexOf(normalizedExcerpt);
  if (characterIndex < 0) return null;
  const start = normalizedPrompt.slice(0, characterIndex).split("\n").length;
  return { start, end: start + normalizedExcerpt.split("\n").length - 1 };
}

function inRange(line: number | null, range: LineRange | null) {
  return line !== null && range !== null && line >= range.start && line <= range.end;
}
