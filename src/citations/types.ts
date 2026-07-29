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
}

export interface ParsedStatusCitation {
  kind: "status";
  raw: string;
}

export interface ParsedCitationError {
  kind: "error";
  raw: string;
  message: string;
}

export type ParsedCitation =
  | ParsedBibleCitation
  | ParsedStatusCitation
  | ParsedCitationError;
