import { BOOKS, type BookSlug } from "./books.js";
import { isTranslation, type Translation } from "./lookup.js";
import type {
  ParsedCitation,
  ParsedCitationError,
  ParsedIgnoredCitation,
} from "../types.js";

const BRACKET_PATTERN = /\[([^\]]+)\]/g;
const CITATION_ATTEMPT_PATTERN = /^(.+?)\s+\d+:/;
const LOCATION_PATTERN = /^(.+?)\s+(\d+):([\d,\-\s]+)$/;
const STATUS_PATTERN = /^tyndale\s+status$/i;

function normalizeBookInput(input: string): string {
  return input.toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
}

const bookInputToSlug = new Map<string, BookSlug>(
  BOOKS.flatMap((book) => {
    const keys = new Set<string>([
      normalizeBookInput(book.name),
      normalizeBookInput(book.slug),
      book.slug,
      ...book.aliases.map(normalizeBookInput),
      ...book.abbrevs.map(normalizeBookInput),
    ]);

    return [...keys].map((key) => [key, book.slug] as const);
  }),
);

export function resolveBookInput(input: string): BookSlug | undefined {
  const trimmed = input.trim();
  if (!trimmed) {
    return undefined;
  }

  return (
    bookInputToSlug.get(normalizeBookInput(trimmed)) ??
    bookInputToSlug.get(trimmed.toLowerCase())
  );
}

export function getBookName(slug: BookSlug): string {
  const book = BOOKS.find((entry) => entry.slug === slug);
  return book?.name ?? slug;
}

function expandVerseSpec(spec: string): number[] {
  const verses: number[] = [];
  const normalized = spec.trim();

  if (!/^[\d,\-\s]+$/.test(normalized)) {
    throw new Error(`Invalid verse specification: ${spec}`);
  }

  for (const part of normalized.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.includes("-")) {
      const [startText, endText] = trimmed.split("-");
      const start = Number.parseInt(startText?.trim() ?? "", 10);
      const end = Number.parseInt(endText?.trim() ?? "", 10);

      if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
        throw new Error(`Invalid verse range: ${trimmed}`);
      }

      for (let verse = start; verse <= end; verse += 1) {
        verses.push(verse);
      }
      continue;
    }

    const verse = Number.parseInt(trimmed, 10);
    if (Number.isNaN(verse)) {
      throw new Error(`Invalid verse: ${trimmed}`);
    }
    verses.push(verse);
  }

  return verses;
}

function ignoredCitation(raw: string): ParsedIgnoredCitation {
  return { kind: "ignored", raw };
}

function parseBracketContent(raw: string, inner: string): ParsedCitation {
  const content = inner.trim();
  if (!content) {
    return ignoredCitation(raw);
  }

  if (STATUS_PATTERN.test(content)) {
    return { kind: "status", raw };
  }

  let translation: Translation | undefined;
  let remainder = content;

  const firstSpace = content.indexOf(" ");
  if (firstSpace !== -1) {
    const maybeTranslation = content.slice(0, firstSpace).toLowerCase();
    if (isTranslation(maybeTranslation)) {
      translation = maybeTranslation;
      remainder = content.slice(firstSpace + 1).trim();
    }
  }

  if (!CITATION_ATTEMPT_PATTERN.test(remainder)) {
    return ignoredCitation(raw);
  }

  if (!LOCATION_PATTERN.test(remainder)) {
    return errorCitation(raw, `Invalid citation format in ${raw}`);
  }

  const locationMatch = LOCATION_PATTERN.exec(remainder);
  if (!locationMatch) {
    return errorCitation(raw, `Invalid citation format in ${raw}`);
  }

  const [, bookPart, chapterText, verseSpec] = locationMatch;
  const book = resolveBookInput(bookPart ?? "");
  if (!book) {
    return errorCitation(
      raw,
      `Could not parse book "${bookPart?.trim() ?? ""}" in ${raw}`,
    );
  }

  const chapter = Number.parseInt(chapterText ?? "", 10);
  if (Number.isNaN(chapter)) {
    return errorCitation(raw, `Invalid chapter in ${raw}`);
  }

  let verses: number[];
  try {
    verses = expandVerseSpec(verseSpec ?? "");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid verse specification";
    return errorCitation(raw, `${message} in ${raw}`);
  }

  if (verses.length === 0) {
    return errorCitation(raw, `No verses specified in ${raw}`);
  }

  return {
    kind: "bible",
    raw,
    translation,
    book,
    bookName: getBookName(book),
    chapter,
    verses,
  };
}

function errorCitation(raw: string, message: string): ParsedCitationError {
  return { kind: "error", raw, message };
}

export function parseBracketCitation(raw: string): ParsedCitation {
  const inner = raw.startsWith("[") && raw.endsWith("]")
    ? raw.slice(1, -1)
    : raw;
  return parseBracketContent(raw, inner);
}

export function findBracketCitations(text: string): ParsedCitation[] {
  const citations: ParsedCitation[] = [];

  for (const match of text.matchAll(BRACKET_PATTERN)) {
    const inner = match[1];
    if (inner === undefined) {
      continue;
    }

    const citation = parseBracketContent(match[0], inner);
    if (citation.kind === "ignored") {
      continue;
    }

    citations.push(citation);
  }

  return citations;
}
