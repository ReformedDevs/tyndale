import type { BookSlug } from "./books.js";

export const TEXT_FORMATS = ["literary", "paragraph", "verse"] as const;

export type TextFormat = (typeof TEXT_FORMATS)[number];

export type VerseLayout = "paragraph" | "verse" | "usfm";

/** Books typically printed with one verse per line (poetry / wisdom). */
const POETRY_BOOKS = new Set<BookSlug>([
  "job",
  "ps",
  "prov",
  "eccl",
  "song",
  "lam",
]);

const TEXT_FORMAT_LABELS: Record<TextFormat, string> = {
  literary: "Literary",
  paragraph: "Paragraph",
  verse: "Verse",
};

export function isTextFormat(value: string): value is TextFormat {
  return (TEXT_FORMATS as readonly string[]).includes(value);
}

export function normalizeTextFormat(value: string): TextFormat | undefined {
  const normalized = value.trim().toLowerCase();

  if (isTextFormat(normalized)) {
    return normalized;
  }

  if (normalized === "auto" || normalized === "bible") {
    return "literary";
  }

  if (normalized === "lines" || normalized === "line") {
    return "verse";
  }

  return undefined;
}

export function formatTextFormatLabel(format: TextFormat): string {
  return TEXT_FORMAT_LABELS[format];
}

export function isPoetryBook(book: BookSlug): boolean {
  return POETRY_BOOKS.has(book);
}

export function resolveVerseLayout(
  format: TextFormat,
  book: BookSlug,
  hasUsfmLayout = false,
): VerseLayout {
  if (format === "verse") {
    return "verse";
  }

  if (format === "paragraph") {
    return "paragraph";
  }

  if (hasUsfmLayout) {
    return "usfm";
  }

  if (isPoetryBook(book)) {
    return "verse";
  }

  return "paragraph";
}

export function joinVerseLines(
  lines: string[],
  layout: VerseLayout,
): string {
  if (layout === "paragraph") {
    return lines.join(" ");
  }

  return lines.join("\n");
}

export function formatQuoteBlock(
  lines: string[],
  layout: VerseLayout,
): string {
  if (layout === "paragraph") {
    return `> ${lines.join(" ")}`;
  }

  return lines.map((line) => (line ? `> ${line}` : ">")).join("\n");
}
