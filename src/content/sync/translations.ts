import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  bookNameToSlug,
  verseKey,
  type BookSlug,
} from "../../citations/bible/books.js";
import type { VerseIndex } from "../../citations/bible/lookup.js";
import type { PoetryLayoutIndex } from "../../citations/bible/poetry-layout.js";
import {
  mergePoetryIndexes,
  parseUsfmFile,
  usfmIdToBookSlug,
} from "../../citations/bible/usfm-poetry-parser.js";
import type { TranslationRegistryEntry } from "../registry.js";
import type { ContentPaths } from "../../paths.js";

const execFileAsync = promisify(execFile);

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

async function fetchToFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, buffer);
}

function addVerse(
  index: VerseIndex,
  bookName: string,
  chapter: number,
  verse: number,
  text: string,
): boolean {
  const slug = bookNameToSlug(bookName);
  if (!slug) {
    return false;
  }

  index[verseKey(slug, chapter, verse)] = text.trim();
  return true;
}

function buildWebIndex(rows: WebVerseRow[]): VerseIndex {
  const index: VerseIndex = {};

  for (const row of rows) {
    if (!addVerse(index, row.book, row.chapter, row.verse, row.text)) {
      throw new Error(`Unknown book name: ${row.book}`);
    }
  }

  return index;
}

function buildScrollmapperIndex(bible: ScrollmapperBible): VerseIndex {
  const index: VerseIndex = {};
  const skippedBooks = new Set<string>();

  for (const book of bible.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        if (
          !addVerse(
            index,
            book.name,
            chapter.chapter,
            verse.verse,
            verse.text,
          )
        ) {
          skippedBooks.add(book.name);
        }
      }
    }
  }

  if (skippedBooks.size > 0) {
    console.info(
      `Skipped ${skippedBooks.size} unsupported book(s): ${[...skippedBooks].sort().join(", ")}`,
    );
  }

  return index;
}

function isWebSource(source: string): boolean {
  return source.includes("webu-open-bible") || source.endsWith("complete-bible.json");
}

async function buildVerseIndex(entry: TranslationRegistryEntry): Promise<VerseIndex> {
  if (isWebSource(entry.source)) {
    const rows = await fetchJson<WebVerseRow[]>(entry.source);
    return buildWebIndex(rows);
  }

  const bible = await fetchJson<ScrollmapperBible>(entry.source);
  return buildScrollmapperIndex(bible);
}

async function buildPoetryIndexFromZip(
  translationId: string,
  zipUrl: string,
  workDir: string,
): Promise<PoetryLayoutIndex> {
  const zipPath = path.join(workDir, `${translationId}-usfm.zip`);
  const extractDir = path.join(workDir, translationId);

  console.info(`Fetching ${translationId.toUpperCase()} USFM...`);
  await fetchToFile(zipUrl, zipPath);
  await mkdir(extractDir, { recursive: true });
  await execFileAsync("unzip", ["-q", zipPath, "-d", extractDir]);

  const files = (await readdir(extractDir)).filter((name) => name.endsWith(".usfm"));
  const indexes: PoetryLayoutIndex[] = [];
  const skippedFiles: string[] = [];

  for (const fileName of files) {
    const content = await readFile(path.join(extractDir, fileName), "utf8");
    const idMatch = /^\\id\s+(\S+)/m.exec(content);
    const book = idMatch ? usfmIdToBookSlug(idMatch[1] ?? "") : undefined;

    if (!book) {
      skippedFiles.push(fileName);
      continue;
    }

    console.info(`Parsing ${translationId.toUpperCase()} ${fileName} (${book})...`);
    indexes.push(parseUsfmFile(content));
  }

  if (skippedFiles.length > 0) {
    console.info(
      `Skipped ${skippedFiles.length} unsupported USFM file(s) for ${translationId.toUpperCase()}`,
    );
  }

  return mergePoetryIndexes(indexes);
}

function countVerses(index: VerseIndex): number {
  return Object.keys(index).length;
}

async function sanityCheckTranslation(
  translationId: string,
  paths: ContentPaths,
): Promise<void> {
  const filePath = path.join(paths.bibles, `${translationId}.json`);
  const index = JSON.parse(await readFile(filePath, "utf8")) as VerseIndex;
  const sanityBook: BookSlug = "gen";
  const key = verseKey(sanityBook, 1, 1);
  if (!index[key]) {
    throw new Error(`Sanity check failed: missing ${translationId} ${key}`);
  }
}

export async function syncTranslation(
  entry: TranslationRegistryEntry,
  paths: ContentPaths,
): Promise<void> {
  await mkdir(paths.bibles, { recursive: true });
  await mkdir(paths.poetry, { recursive: true });

  console.info(`Fetching ${entry.id.toUpperCase()} bible text...`);
  const index = await buildVerseIndex(entry);
  const biblePath = path.join(paths.bibles, `${entry.id}.json`);
  await writeFile(biblePath, JSON.stringify(index));
  console.info(`Wrote bibles/${entry.id}.json (${countVerses(index)} verses)`);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "tyndale-usfm-"));
  try {
    const poetryIndex = await buildPoetryIndexFromZip(
      entry.id,
      entry.poetrySource,
      tempDir,
    );
    const poetryPath = path.join(paths.poetry, `${entry.id}.json`);
    await writeFile(poetryPath, JSON.stringify(poetryIndex));
    console.info(
      `Wrote poetry/${entry.id}.json (${Object.keys(poetryIndex).length} verse layouts)`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  await sanityCheckTranslation(entry.id, paths);
}
