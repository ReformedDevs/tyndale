import type { BookSlug } from "./bible/books.js";
import type { Translation } from "./bible/lookup.js";
import type { TextFormat } from "./bible/text-format.js";
import type { Confession } from "./confessions/lookup.js";

export type CitationSource = "bible" | "lbcf" | "wcf";

export interface ConfessionLocation {
  chapter: number;
  paragraph: number;
}

export interface ParsedConfessionCitation {
  kind: "confession";
  raw: string;
  confession: Confession;
  locations: ConfessionLocation[];
  /** When set, expands to all paragraphs in this chapter at lookup time. */
  wholeChapter?: number;
  /** When set, expands from this paragraph through the chapter end at lookup time. */
  chapterEndFrom?: ConfessionLocation;
  range?: {
    startChapter: number;
    startParagraph: number;
    endChapter: number;
    endParagraph: number;
  };
}

export interface ParsedBibleCitation {
  kind: "bible";
  raw: string;
  translation?: Translation;
  book: BookSlug;
  bookName: string;
  chapter: number;
  verses: number[];
  /** When set, verses are expanded from this number through the chapter end at lookup time. */
  chapterEndFrom?: number;
}

export interface ParsedStatusCitation {
  kind: "status";
  raw: string;
}

export interface ParsedServerStatusCitation {
  kind: "serverStatus";
  raw: string;
}

export interface ParsedHelpCitation {
  kind: "help";
  raw: string;
}

export interface ParsedFormatCitation {
  kind: "format";
  raw: string;
  action: "show" | "set" | "reset";
  format?: TextFormat;
}

export interface ParsedServerFormatCitation {
  kind: "serverFormat";
  raw: string;
  action: "show" | "set" | "reset";
  format?: TextFormat;
}

export interface ParsedCitationError {
  kind: "error";
  raw: string;
  message: string;
}

export interface ParsedIgnoredCitation {
  kind: "ignored";
  raw: string;
}

export type ParsedCitation =
  | ParsedBibleCitation
  | ParsedConfessionCitation
  | ParsedStatusCitation
  | ParsedServerStatusCitation
  | ParsedHelpCitation
  | ParsedFormatCitation
  | ParsedServerFormatCitation
  | ParsedCitationError
  | ParsedIgnoredCitation;
