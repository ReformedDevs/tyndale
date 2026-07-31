import { BOOKS, type BookSlug } from "./books.js";
import { normalizeTranslation, type Translation } from "./lookup.js";
import { normalizeTextFormat } from "./text-format.js";
import { parseConfessionBracket, parseConfessionDiffBracket } from "../confessions/parser.js";
import type {
  ParsedCitation,
  ParsedCitationError,
  ParsedBibleCitation,
  ParsedIgnoredCitation,
} from "../types.js";

const BRACKET_PATTERN = /\[([^\]]+)\]/g;
const CITATION_ATTEMPT_PATTERN = /^(.+?)\s+\d+(?::|$|-\d+)/;
const CHAPTER_ONLY_PATTERN = /^(.+?)\s+(\d+)$/;
const CHAPTER_RANGE_PATTERN = /^(.+?)\s+(\d+)-(\d+)$/;
const CHAPTER_END_PATTERN = /^(.+?)\s+(\d+):(?:(\d+)-)?end$/i;
const CROSS_CHAPTER_RANGE_PATTERN = /^(.+?)\s+(\d+):(\d+)-(\d+):(\d+)$/;
const LOCATION_PATTERN = /^(.+?)\s+(\d+):([\d,\-\s]+)$/;
const STATUS_PATTERN = /^tyndale\s+status$/i;
const SERVER_STATUS_PATTERN = /^tyndale\s+server\s+status$/i;
const HELP_PATTERN = /^tyndale\s+help$/i;
const SERVER_FORMAT_PATTERN = /^tyndale\s+server\s+format(?:\s+(\S+))?$/i;
const FORMAT_PATTERN = /^tyndale\s+format(?:\s+(\S+))?$/i;

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

  return bookInputToSlug.get(normalizeBookInput(trimmed));
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

function parseBookChapter(
  raw: string,
  bookPart: string,
  chapterText: string,
  translation?: Translation,
): ParsedCitation | ParsedBibleCitation {
  const book = resolveBookInput(bookPart.trim());
  if (!book) {
    return errorCitation(
      raw,
      `Could not parse book "${bookPart.trim()}" in ${raw}`,
    );
  }

  const chapter = Number.parseInt(chapterText, 10);
  if (Number.isNaN(chapter)) {
    return errorCitation(raw, `Invalid chapter in ${raw}`);
  }

  return {
    kind: "bible",
    raw,
    translation,
    book,
    bookName: getBookName(book),
    chapter,
    verses: [],
  };
}

function parseBracketContent(raw: string, inner: string): ParsedCitation {
  const content = inner.trim();
  if (!content) {
    return ignoredCitation(raw);
  }

  const normalized = content.toLowerCase();

  if (STATUS_PATTERN.test(normalized)) {
    return { kind: "status", raw };
  }

  if (HELP_PATTERN.test(normalized)) {
    return { kind: "help", raw };
  }

  if (SERVER_STATUS_PATTERN.test(normalized)) {
    return { kind: "serverStatus", raw };
  }

  const serverFormatMatch = SERVER_FORMAT_PATTERN.exec(normalized);
  if (serverFormatMatch) {
    const value = serverFormatMatch[1]?.trim();

    if (!value) {
      return { kind: "serverFormat", raw, action: "show" };
    }

    if (value.toLowerCase() === "reset") {
      return { kind: "serverFormat", raw, action: "reset" };
    }

    const format = normalizeTextFormat(value);
    if (!format) {
      return errorCitation(
        raw,
        `Unknown format "${value}". Use literary, paragraph, or verse.`,
      );
    }

    return {
      kind: "serverFormat",
      raw,
      action: "set",
      format,
    };
  }

  const formatMatch = FORMAT_PATTERN.exec(normalized);
  if (formatMatch) {
    const value = formatMatch[1]?.trim();

    if (!value) {
      return { kind: "format", raw, action: "show" };
    }

    if (value.toLowerCase() === "reset") {
      return { kind: "format", raw, action: "reset" };
    }

    const format = normalizeTextFormat(value);
    if (!format) {
      return errorCitation(
        raw,
        `Unknown format "${value}". Use literary, paragraph, or verse.`,
      );
    }

    return {
      kind: "format",
      raw,
      action: "set",
      format,
    };
  }

  const confessionDiffCitation = parseConfessionDiffBracket(raw, content);
  if (confessionDiffCitation) {
    return confessionDiffCitation;
  }

  const confessionCitation = parseConfessionBracket(raw, content);
  if (confessionCitation) {
    return confessionCitation;
  }

  let translation: Translation | undefined;
  let remainder = content;

  const firstSpace = content.indexOf(" ");
  if (firstSpace !== -1) {
    const maybeTranslation = content.slice(0, firstSpace);
    translation = normalizeTranslation(maybeTranslation);
    if (translation) {
      remainder = content.slice(firstSpace + 1).trim();
    }
  }

  if (!CITATION_ATTEMPT_PATTERN.test(remainder)) {
    return ignoredCitation(raw);
  }

  const chapterOnlyMatch = CHAPTER_ONLY_PATTERN.exec(remainder);
  if (chapterOnlyMatch) {
    const [, bookPart, chapterText] = chapterOnlyMatch;
    const parsed = parseBookChapter(
      raw,
      bookPart ?? "",
      chapterText ?? "",
      translation,
    );
    if (parsed.kind !== "bible") {
      return parsed;
    }

    return { ...parsed, chapterEndFrom: 1 };
  }

  const chapterRangeMatch = CHAPTER_RANGE_PATTERN.exec(remainder);
  if (chapterRangeMatch) {
    const [, bookPart, startChapterText, endChapterText] = chapterRangeMatch;
    const parsed = parseBookChapter(
      raw,
      bookPart ?? "",
      startChapterText ?? "",
      translation,
    );
    if (parsed.kind !== "bible") {
      return parsed;
    }

    const endChapter = Number.parseInt(endChapterText ?? "", 10);
    if (Number.isNaN(endChapter)) {
      return errorCitation(raw, `Invalid citation format in ${raw}`);
    }

    if (parsed.chapter > endChapter) {
      return errorCitation(raw, `Invalid chapter range in ${raw}`);
    }

    return {
      ...parsed,
      chapterRange: {
        startChapter: parsed.chapter,
        endChapter,
      },
    };
  }

  const chapterEndMatch = CHAPTER_END_PATTERN.exec(remainder);
  if (chapterEndMatch) {
    const [, bookPart, chapterText, fromVerseText] = chapterEndMatch;
    const parsed = parseBookChapter(
      raw,
      bookPart ?? "",
      chapterText ?? "",
      translation,
    );
    if (parsed.kind !== "bible") {
      return parsed;
    }

    const fromVerse = fromVerseText
      ? Number.parseInt(fromVerseText, 10)
      : 1;
    if (Number.isNaN(fromVerse) || fromVerse < 1) {
      return errorCitation(raw, `Invalid citation format in ${raw}`);
    }

    return { ...parsed, chapterEndFrom: fromVerse };
  }

  const crossChapterRangeMatch = CROSS_CHAPTER_RANGE_PATTERN.exec(remainder);
  if (crossChapterRangeMatch) {
    const [
      ,
      bookPart,
      startChapterText,
      startVerseText,
      endChapterText,
      endVerseText,
    ] = crossChapterRangeMatch;
    const parsed = parseBookChapter(
      raw,
      bookPart ?? "",
      startChapterText ?? "",
      translation,
    );
    if (parsed.kind !== "bible") {
      return parsed;
    }

    const startVerse = Number.parseInt(startVerseText ?? "", 10);
    const endChapter = Number.parseInt(endChapterText ?? "", 10);
    const endVerse = Number.parseInt(endVerseText ?? "", 10);

    if (
      Number.isNaN(startVerse) ||
      Number.isNaN(endChapter) ||
      Number.isNaN(endVerse) ||
      startVerse < 1 ||
      endVerse < 1
    ) {
      return errorCitation(raw, `Invalid citation format in ${raw}`);
    }

    if (
      parsed.chapter > endChapter ||
      (parsed.chapter === endChapter && startVerse > endVerse)
    ) {
      return errorCitation(raw, `Invalid verse range in ${raw}`);
    }

    return {
      ...parsed,
      verses: [],
      range: {
        startChapter: parsed.chapter,
        startVerse,
        endChapter,
        endVerse,
      },
    };
  }

  if (!LOCATION_PATTERN.test(remainder)) {
    return errorCitation(raw, `Invalid citation format in ${raw}`);
  }

  const locationMatch = LOCATION_PATTERN.exec(remainder);
  if (!locationMatch) {
    return errorCitation(raw, `Invalid citation format in ${raw}`);
  }

  const [, bookPart, chapterText, verseSpec] = locationMatch;
  const parsed = parseBookChapter(
    raw,
    bookPart ?? "",
    chapterText ?? "",
    translation,
  );
  if (parsed.kind !== "bible") {
    return parsed;
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

  return { ...parsed, verses };
}

function errorCitation(raw: string, message: string): ParsedCitationError {
  return { kind: "error", raw, message };
}

export function parseScriptureReference(
  reference: string,
): ParsedBibleCitation | undefined {
  const trimmed = reference.trim();

  const crossChapterMatch = CROSS_CHAPTER_RANGE_PATTERN.exec(trimmed);
  if (crossChapterMatch) {
    const [
      ,
      bookPart,
      startChapterText,
      startVerseText,
      endChapterText,
      endVerseText,
    ] = crossChapterMatch;
    const parsed = parseBookChapter(
      `[${trimmed}]`,
      bookPart ?? "",
      startChapterText ?? "",
    );
    if (parsed.kind !== "bible") {
      return undefined;
    }

    const startVerse = Number.parseInt(startVerseText ?? "", 10);
    const endChapter = Number.parseInt(endChapterText ?? "", 10);
    const endVerse = Number.parseInt(endVerseText ?? "", 10);

    if (
      Number.isNaN(startVerse) ||
      Number.isNaN(endChapter) ||
      Number.isNaN(endVerse) ||
      startVerse < 1 ||
      endVerse < 1
    ) {
      return undefined;
    }

    return {
      ...parsed,
      verses: [],
      range: {
        startChapter: parsed.chapter,
        startVerse,
        endChapter,
        endVerse,
      },
    };
  }

  const match = LOCATION_PATTERN.exec(trimmed);
  if (!match) {
    return undefined;
  }

  const [, bookPart, chapterText, verseSpec] = match;
  const parsed = parseBookChapter(
    `[${trimmed}]`,
    bookPart ?? "",
    chapterText ?? "",
  );
  if (parsed.kind !== "bible") {
    return undefined;
  }

  let verses: number[];
  try {
    verses = expandVerseSpec(verseSpec ?? "");
  } catch {
    return undefined;
  }

  if (verses.length === 0) {
    return undefined;
  }

  return { ...parsed, verses };
}

export function parseBracketCitation(raw: string): ParsedCitation {
  const inner = raw.startsWith("[") && raw.endsWith("]")
    ? raw.slice(1, -1)
    : raw;
  return parseBracketContent(raw, inner);
}

/** Remove markdown quote lines so bracket refs inside block quotes are not scanned. */
export function stripQuoteBlockLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");
}

export function findBracketCitations(text: string): ParsedCitation[] {
  const citations: ParsedCitation[] = [];
  const scannable = stripQuoteBlockLines(text);

  for (const match of scannable.matchAll(BRACKET_PATTERN)) {
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
