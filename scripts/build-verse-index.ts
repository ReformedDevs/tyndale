import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  bookNameToSlug,
  verseKey,
  type BookSlug,
} from "../src/citations/bible/books.js";
import type { Translation, VerseIndex } from "../src/citations/bible/lookup.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const SOURCES = {
  web: "https://raw.githubusercontent.com/ringletech/webu-open-bible/main/json/complete-bible.json",
  asv: "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/ASV.json",
  ylt: "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/YLT.json",
} as const satisfies Record<Translation, string>;

interface WebVerseRow {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ScrollmapperVerse {
  verse: number;
  text: string;
}

interface ScrollmapperChapter {
  chapter: number;
  verses: ScrollmapperVerse[];
}

interface ScrollmapperBook {
  name: string;
  chapters: ScrollmapperChapter[];
}

interface ScrollmapperBible {
  books: ScrollmapperBook[];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

function addVerse(
  index: VerseIndex,
  bookName: string,
  chapter: number,
  verse: number,
  text: string,
): void {
  const slug = bookNameToSlug(bookName);
  if (!slug) {
    throw new Error(`Unknown book name: ${bookName}`);
  }

  index[verseKey(slug, chapter, verse)] = text.trim();
}

function buildWebIndex(rows: WebVerseRow[]): VerseIndex {
  const index: VerseIndex = {};

  for (const row of rows) {
    addVerse(index, row.book, row.chapter, row.verse, row.text);
  }

  return index;
}

function buildScrollmapperIndex(bible: ScrollmapperBible): VerseIndex {
  const index: VerseIndex = {};

  for (const book of bible.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        addVerse(index, book.name, chapter.chapter, verse.verse, verse.text);
      }
    }
  }

  return index;
}

function countVerses(index: VerseIndex): number {
  return Object.keys(index).length;
}

async function writeIndex(
  translation: Translation,
  index: VerseIndex,
): Promise<void> {
  const filePath = path.join(dataDir, `${translation}.json`);
  await writeFile(filePath, JSON.stringify(index));
  console.info(`Wrote ${translation}.json (${countVerses(index)} verses)`);
}

async function main(): Promise<void> {
  await mkdir(dataDir, { recursive: true });

  console.info("Fetching WEB...");
  const webRows = await fetchJson<WebVerseRow[]>(SOURCES.web);
  await writeIndex("web", buildWebIndex(webRows));

  console.info("Fetching ASV...");
  const asvBible = await fetchJson<ScrollmapperBible>(SOURCES.asv);
  await writeIndex("asv", buildScrollmapperIndex(asvBible));

  console.info("Fetching YLT...");
  const yltBible = await fetchJson<ScrollmapperBible>(SOURCES.ylt);
  await writeIndex("ylt", buildScrollmapperIndex(yltBible));

  // Sanity check: Genesis 1:1 exists in all translations
  const sanityBook: BookSlug = "gen";
  for (const translation of ["web", "asv", "ylt"] as const) {
    const filePath = path.join(dataDir, `${translation}.json`);
    const index = JSON.parse(await readFile(filePath, "utf8")) as VerseIndex;
    const key = verseKey(sanityBook, 1, 1);
    if (!index[key]) {
      throw new Error(`Sanity check failed: missing ${translation} ${key}`);
    }
  }

  console.info("Done.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
