import { verseKey, type BookSlug } from "./books.js";
import type { PoetryLayoutIndex, PoetryLine, PoetryVerseLayout } from "./poetry-layout.js";

const USFM_ID_TO_SLUG: Record<string, BookSlug> = {
  GEN: "gen",
  EXO: "exod",
  LEV: "lev",
  NUM: "num",
  DEU: "deut",
  JOS: "josh",
  JDG: "judg",
  RUT: "ruth",
  "1SA": "1sam",
  "2SA": "2sam",
  "1KI": "1kgs",
  "2KI": "2kgs",
  "1CH": "1chr",
  "2CH": "2chr",
  EZR: "ezra",
  NEH: "neh",
  EST: "esth",
  JOB: "job",
  PSA: "ps",
  PRO: "prov",
  ECC: "eccl",
  SNG: "song",
  ISA: "isa",
  JER: "jer",
  LAM: "lam",
  EZK: "ezek",
  DAN: "dan",
  HOS: "hos",
  JOL: "joel",
  AMO: "amos",
  OBA: "obad",
  JON: "jonah",
  MIC: "mic",
  NAM: "nah",
  NAH: "nah",
  HAB: "hab",
  ZEP: "zeph",
  HAG: "hag",
  ZEC: "zech",
  MAL: "mal",
  MAT: "matt",
  MRK: "mark",
  LUK: "luke",
  JHN: "john",
  ACT: "acts",
  ROM: "rom",
  "1CO": "1cor",
  "2CO": "2cor",
  GAL: "gal",
  EPH: "eph",
  PHP: "phil",
  COL: "col",
  "1TH": "1thess",
  "2TH": "2thess",
  "1TI": "1tim",
  "2TI": "2tim",
  TIT: "titus",
  PHM: "phlm",
  HEB: "heb",
  JAS: "jas",
  "1PE": "1pet",
  "2PE": "2pet",
  "1JN": "1john",
  "2JN": "2john",
  "3JN": "3john",
  JUD: "jude",
  REV: "rev",
};

const PARAGRAPH_MARKERS = /^\\(p|m|mi|nb|pi|pm|pmo|pmc|pmr)\b/;

export function usfmIdToBookSlug(id: string): BookSlug | undefined {
  return USFM_ID_TO_SLUG[id.trim().toUpperCase()];
}

export function cleanUsfmText(raw: string): string {
  let text = raw;
  text = text.replace(/\\f\s[\s\S]*?\\f\*/g, "");
  text = text.replace(/\\w\s*([^\\]*?)\\w\*/g, (_, body: string) =>
    body
      .replace(
        /\|(?:strong|lemma|x-strong|x-lemma|src|greek|hebrew)="[^"]*"/gi,
        "",
      )
      .trim(),
  );
  text = text.replace(
    /\|(?:strong|lemma|x-strong|x-lemma|src|greek|hebrew)="[^"]*"/gi,
    "",
  );
  text = text.replace(/\\w\s*/g, "");
  text = text.replace(/\\w\*/g, "");
  text = text.replace(/\\\+?[a-z0-9]+\*?/gi, "");
  text = text.replace(/\\[a-z0-9]+\s*/gi, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function clampIndent(value: number): 1 | 2 | 3 {
  if (value <= 1) {
    return 1;
  }

  if (value === 2) {
    return 2;
  }

  return 3;
}

function ensureVerseLayout(
  index: PoetryLayoutIndex,
  key: string,
): PoetryVerseLayout {
  if (!index[key]) {
    index[key] = { lines: [] };
  }

  return index[key]!;
}

function addLayoutLine(
  index: PoetryLayoutIndex,
  key: string,
  indent: number,
  text: string,
): void {
  const cleaned = cleanUsfmText(text);
  if (!cleaned) {
    return;
  }

  const layout = ensureVerseLayout(index, key);
  const line: PoetryLine = {
    indent: clampIndent(indent),
    text: cleaned,
  };
  layout.lines.push(line);
}

export function parseUsfmLayout(
  content: string,
  book: BookSlug,
): PoetryLayoutIndex {
  const index: PoetryLayoutIndex = {};
  let chapter = 0;
  let currentVerse = 0;
  let pendingIndent = 1;
  let pendingParagraphBreak = false;
  let lastVerseKey: string | undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("\\")) {
      continue;
    }

    const chapterMatch = /^\\c\s+(\d+)/.exec(line);
    if (chapterMatch) {
      chapter = Number.parseInt(chapterMatch[1] ?? "", 10);
      currentVerse = 0;
      pendingIndent = 1;
      pendingParagraphBreak = false;
      lastVerseKey = undefined;
      continue;
    }

    if (/^\\b\s*$/.test(line)) {
      if (lastVerseKey) {
        ensureVerseLayout(index, lastVerseKey).stanzaBreakAfter = true;
      }
      continue;
    }

    if (PARAGRAPH_MARKERS.test(line) && !/^\\v\s+\d+/.test(line)) {
      pendingParagraphBreak = true;
      if (/^\\p\s*$/.test(line) || /^\\m\s*$/.test(line)) {
        continue;
      }
    }

    const qOnlyMatch = /^\\q(\d)?\s*$/.exec(line);
    if (qOnlyMatch) {
      pendingIndent = qOnlyMatch[1]
        ? Number.parseInt(qOnlyMatch[1], 10)
        : 1;
      continue;
    }

    const hasPoetryMarker = /^\\q(\d)?\s/.test(line);
    const hasVerseMarker = /\\v\s+\d+/.test(line);

    if (!hasPoetryMarker && !hasVerseMarker) {
      continue;
    }

    let remaining = line;
    let lineIndent = pendingIndent;

    const qMatch = /^\\q(\d)?\s*/.exec(remaining);
    if (qMatch) {
      lineIndent = qMatch[1] ? Number.parseInt(qMatch[1], 10) : 1;
      pendingIndent = lineIndent;
      remaining = remaining.slice(qMatch[0].length);
    }

    const verseMatch = /^\\v\s+(\d+)\s*(.*)/.exec(remaining);
    if (verseMatch) {
      currentVerse = Number.parseInt(verseMatch[1] ?? "", 10);
      remaining = verseMatch[2] ?? "";

      if (chapter <= 0 || currentVerse <= 0) {
        continue;
      }

      const key = verseKey(book, chapter, currentVerse);
      lastVerseKey = key;

      if (pendingParagraphBreak) {
        ensureVerseLayout(index, key).paragraphBreakBefore = true;
        pendingParagraphBreak = false;
      }
    }

    if (chapter <= 0 || currentVerse <= 0) {
      continue;
    }

    const key = verseKey(book, chapter, currentVerse);
    addLayoutLine(index, key, lineIndent, remaining);
  }

  return index;
}

/** @deprecated Use parseUsfmLayout */
export const parseUsfmPoetry = parseUsfmLayout;

export function parseUsfmFile(content: string): PoetryLayoutIndex {
  const idMatch = /^\\id\s+(\S+)/m.exec(content);
  const book = idMatch ? usfmIdToBookSlug(idMatch[1] ?? "") : undefined;

  if (!book) {
    return {};
  }

  return parseUsfmLayout(content, book);
}

export function mergePoetryIndexes(
  indexes: PoetryLayoutIndex[],
): PoetryLayoutIndex {
  return indexes.reduce<PoetryLayoutIndex>((merged, index) => {
    return { ...merged, ...index };
  }, {});
}
