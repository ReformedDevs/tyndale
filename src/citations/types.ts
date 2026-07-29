import type { BookSlug } from "./bible/books.js";
import type { Translation } from "./bible/lookup.js";

export type CitationSource = "bible" | "lbcf" | "wcf";

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

export interface ParsedHelpCitation {
  kind: "help";
  raw: string;
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
  | ParsedStatusCitation
  | ParsedHelpCitation
  | ParsedCitationError
  | ParsedIgnoredCitation;
