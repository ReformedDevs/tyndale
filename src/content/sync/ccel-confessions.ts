import type { ConfessionDocument } from "../../citations/confessions/lookup.js";

const WCF_CHAPTER_ROMANS = [
  "i",
  "ii",
  "iii",
  "iv",
  "v",
  "vi",
  "vii",
  "viii",
  "ix",
  "x",
  "xi",
  "xii",
  "xiii",
  "xiv",
  "xv",
  "xvi",
  "xvii",
  "xviii",
  "xix",
  "xx",
  "xxi",
  "xxii",
  "xxiii",
  "xxiv",
  "xxv",
  "xxvi",
  "xxvii",
  "xxviii",
  "xxix",
  "xxx",
  "xxxi",
  "xxxii",
  "xxxiii",
  "xxxiv",
  "xxxv",
  "xxxvi",
] as const;

const CREEDS_WCF_URL =
  "https://raw.githubusercontent.com/NonlinearFruit/Creeds.json/master/creeds/westminster_confession_of_faith.json";

const LBCF_CHAPTER_COUNT = 32;
const CCEL_BASE = "https://www.ccel.org";

export type CcelConfessionKind = "westminster3" | "lbcf";

export function parseCcelConfessionSource(
  source: string,
): { kind: CcelConfessionKind } | { error: string } {
  const prefix = "ccel:";
  if (!source.startsWith(prefix)) {
    return { error: `Expected ccel: source, got ${source}` };
  }

  const kind = source.slice(prefix.length).trim();
  if (kind === "westminster3" || kind === "lbcf") {
    return { kind };
  }

  return {
    error: `Unknown CCEL confession kind "${kind}" (expected westminster3 or lbcf)`,
  };
}

async function fetchText(url: string, retries = 3): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
  }

  throw lastError;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function stripScriptureRefs(html: string): string {
  return html.replace(/<I>\s*<A[^>]*>\([^)]*\)<\/A>\s*<\/I>/gi, "");
}

function resolveWestminsterVariants(text: string): string {
  return text
    .replace(/\[PCUS ([^\]]+)\]\s*\[UPCUSA ([^\]]+)\]/g, "$2")
    .replace(/\[UPCUSA ([^\]]+)\]\s*\[PCUS ([^\]]+)\]/g, "$1")
    .replace(/\[PCUS ([^\]]+)\]/g, "$1")
    .replace(/\[UPCUSA ([^\]]+)\]/g, "$1");
}

function normalizeParagraphText(text: string): string {
  return resolveWestminsterVariants(stripHtml(stripScriptureRefs(text)));
}

function extractTagText(html: string, tagPattern: RegExp): string | undefined {
  const match = html.match(tagPattern);
  if (!match?.[1]) {
    return undefined;
  }

  return normalizeParagraphText(match[1]);
}

function parseWestminster3StandardChapter(html: string): number | null {
  const navbarMatch = html.match(/book_navbar_title">([^<]+)</i);
  const navbarTitle = navbarMatch?.[1]?.trim() ?? "";

  if (/Chapter 9 \(34\)|Chapter 10 \(35\)/.test(navbarTitle)) {
    return null;
  }

  if (/Chapter 24: UPCUSA|Chapter 26: PCUS/.test(navbarTitle)) {
    return null;
  }

  const mappedMatch = navbarTitle.match(/Chapter \d+ \((\d+)\)/);
  if (mappedMatch?.[1]) {
    return Number.parseInt(mappedMatch[1], 10);
  }

  const simpleMatch = navbarTitle.match(/^Chapter (\d+)$/);
  if (simpleMatch?.[1]) {
    return Number.parseInt(simpleMatch[1], 10);
  }

  return null;
}

interface CreedsWcfChapter {
  Chapter: string;
  Title: string;
  Sections: Array<{ Section: string; Content: string }>;
}

interface CreedsWcfDocument {
  Data: CreedsWcfChapter[];
}

async function overlayWestminsterChapter24FromCreeds(
  entries: ConfessionDocument["entries"],
): Promise<void> {
  const response = await fetch(CREEDS_WCF_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${CREEDS_WCF_URL}: ${response.status}`);
  }

  const source = (await response.json()) as CreedsWcfDocument;
  const chapter = source.Data.find((entry) => entry.Chapter === "24");
  if (!chapter) {
    throw new Error("Creeds.json WCF chapter 24 was not found.");
  }

  for (const section of chapter.Sections) {
    const paragraph = Number.parseInt(section.Section, 10);
    if (Number.isNaN(paragraph)) {
      continue;
    }

    entries[`24:${paragraph}`] = {
      chapterTitle: chapter.Title,
      text: section.Content.trim(),
    };
  }
}

function formatBookListContinuation(htmlChunk: string): string {
  const sections: string[] = [];
  let currentHeader: string | undefined;
  let currentBooks: string[] = [];

  const flushSection = (): void => {
    if (currentHeader && currentBooks.length > 0) {
      sections.push(`${currentHeader}: ${currentBooks.join(", ")}`);
    }
    currentHeader = undefined;
    currentBooks = [];
  };

  const tokenPattern =
    /<th[^>]*>([\s\S]*?)<\/th>|<p[^>]*class="Continue"[^>]*>([\s\S]*?)<\/p>|<p(?![^>]*class="Continue")[^>]*>([\s\S]*?)<\/p>/gi;

  for (const match of htmlChunk.matchAll(tokenPattern)) {
    if (match[1] !== undefined) {
      flushSection();
      currentHeader = normalizeParagraphText(match[1]);
      continue;
    }

    if (match[2] !== undefined) {
      const book = normalizeParagraphText(match[2]);
      if (book.length > 0) {
        currentBooks.push(book);
      }
      continue;
    }

    const inner = match[3] ?? "";
    if (/^\s*\d+\./.test(inner)) {
      continue;
    }

    flushSection();
    const text = normalizeParagraphText(inner);
    if (text.length > 0) {
      sections.push(text);
    }
  }

  flushSection();
  return sections.join("; ");
}

function parseWestminster3Chapter(
  chapterNumber: number,
  html: string,
): { chapterTitle: string; paragraphs: Map<number, string> } {
  const chapterTitle =
    extractTagText(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ??
    `Chapter ${chapterNumber}`;

  const bookContentMatch = html.match(
    /<div class="book-content">([\s\S]*?)<\/div>\s*<table[^>]*book_navbar_bottom/i,
  );
  const bookContent = bookContentMatch?.[1] ?? html;
  const paragraphs = new Map<number, string>();

  const numberedParagraphPattern =
    /<p(?![^>]*class="Continue")[^>]*>\s*(\d+)\.\s*([\s\S]*?)<\/p>/gi;
  const matches = [...bookContent.matchAll(numberedParagraphPattern)];

  for (const [index, match] of matches.entries()) {
    let paragraphNumber = Number.parseInt(match[1]!, 10);
    if (Number.isNaN(paragraphNumber)) {
      continue;
    }

    const chunkStart = match.index! + match[0].length;
    const chunkEnd = matches[index + 1]?.index ?? bookContent.length;
    const continuation = formatBookListContinuation(
      bookContent.slice(chunkStart, chunkEnd),
    );

    const parts = [normalizeParagraphText(match[2]!)];
    if (continuation.length > 0) {
      parts.push(continuation);
    }

    while (paragraphs.has(paragraphNumber)) {
      paragraphNumber += 1;
    }

    paragraphs.set(paragraphNumber, parts.join(" "));
  }

  return { chapterTitle, paragraphs };
}

function stripLbcfFootnotes(html: string): string {
  return html
    .replace(/<DD[\s\S]*?<\/DD>/gi, "")
    .replace(/<P>\s*<A\s+HREF="scric[\s\S]*?<\/P>/gi, "")
    .replace(/<P>\s*<A\s+HREF="notes\.htm[\s\S]*?<\/P>/gi, "")
    .replace(/<P>\s*<BR>\s*<\/P>/gi, "")
    .replace(/<\/?DL>/gi, "");
}

function isScricFootnoteInner(html: string): boolean {
  const trimmed = html.trim();
  return /^<A\s+HREF="scric/i.test(trimmed);
}

function extractLbcfParagraphText(chunkHtml: string): string {
  let html = chunkHtml.replace(/^\s*\d+[.,]\s*/, "");
  html = stripLbcfFootnotes(html);

  const parts: string[] = [];
  const inlineMatch = html.match(/^([\s\S]*?)<\/(?:P|DT)>/i);
  if (inlineMatch?.[1] && !/^<(?:P|DT)/i.test(html.trim())) {
    const text = normalizeParagraphText(inlineMatch[1]);
    if (text.length > 0) {
      parts.push(text);
    }
    html = html.slice(inlineMatch[0].length);
  }

  for (const match of html.matchAll(/<P[^>]*>([\s\S]*?)<\/P>/gi)) {
    if (isScricFootnoteInner(match[1]!)) {
      continue;
    }

    const text = normalizeParagraphText(match[1]!);
    if (text.length > 0) {
      parts.push(text);
    }
  }

  for (const match of html.matchAll(/<DT[^>]*>([\s\S]*?)<\/DT>/gi)) {
    const text = normalizeParagraphText(match[1]!);
    if (text.length > 0) {
      parts.push(text);
    }
  }

  if (parts.length === 0) {
    return normalizeParagraphText(html);
  }

  return parts.join(" ");
}

function parseLbcfChapter(
  chapterNumber: number,
  html: string,
): { chapterTitle: string; paragraphs: Map<number, string> } {
  const chapterTitle =
    extractTagText(html, /<H1[^>]*>([\s\S]*?)<\/H1>/i) ??
    `Chapter ${chapterNumber}`;

  const bodyMatch = html.match(/<BODY[^>]*>([\s\S]*?)<\/BODY>/i);
  const body = bodyMatch?.[1] ?? html;
  const paragraphs = new Map<number, string>();

  const anchorPattern = /<A NAME="c(\d+)\.(\d+)"><\/A>/gi;
  const anchors = [...body.matchAll(anchorPattern)];

  for (const [index, match] of anchors.entries()) {
    const chapter = Number.parseInt(match[1]!, 10);
    const paragraphNumber = Number.parseInt(match[2]!, 10);
    if (chapter !== chapterNumber || Number.isNaN(paragraphNumber)) {
      continue;
    }

    const chunkStart = match.index! + match[0].length;
    const chunkEnd = anchors[index + 1]?.index ?? body.length;
    const text = extractLbcfParagraphText(body.slice(chunkStart, chunkEnd));
    if (text.length > 0) {
      paragraphs.set(paragraphNumber, text);
    }
  }

  return { chapterTitle, paragraphs };
}

async function buildWestminster3Document(
  abbrev: string,
  title: string,
): Promise<ConfessionDocument> {
  const entries: ConfessionDocument["entries"] = {};

  for (const chapterRoman of WCF_CHAPTER_ROMANS) {
    const url = `${CCEL_BASE}/ccel/anonymous/westminster3/westminster3.i.${chapterRoman}.html`;
    const html = await fetchText(url);
    const chapterNumber = parseWestminster3StandardChapter(html);
    if (chapterNumber === null) {
      continue;
    }

    const { chapterTitle, paragraphs } = parseWestminster3Chapter(
      chapterNumber,
      html,
    );

    for (const [paragraphNumber, text] of paragraphs) {
      entries[`${chapterNumber}:${paragraphNumber}`] = {
        chapterTitle,
        text,
      };
    }
  }

  await overlayWestminsterChapter24FromCreeds(entries);

  return { title, abbrev, entries };
}

async function buildLbcfDocument(
  abbrev: string,
  title: string,
): Promise<ConfessionDocument> {
  const entries: ConfessionDocument["entries"] = {};

  for (let chapterNumber = 1; chapterNumber <= LBCF_CHAPTER_COUNT; chapterNumber += 1) {
    const chapterSlug = String(chapterNumber).padStart(2, "0");
    const url = `${CCEL_BASE}/creeds/bcf/bcfc${chapterSlug}.htm`;
    const html = await fetchText(url);
    const { chapterTitle, paragraphs } = parseLbcfChapter(chapterNumber, html);

    for (const [paragraphNumber, text] of paragraphs) {
      entries[`${chapterNumber}:${paragraphNumber}`] = {
        chapterTitle,
        text,
      };
    }
  }

  return { title, abbrev, entries };
}

export async function fetchCcelConfessionDocument(
  kind: CcelConfessionKind,
  abbrev: string,
  title: string,
): Promise<ConfessionDocument> {
  if (kind === "westminster3") {
    return buildWestminster3Document(abbrev, title);
  }

  return buildLbcfDocument(abbrev, title);
}

export {
  extractLbcfParagraphText,
  normalizeParagraphText,
  parseLbcfChapter,
  parseWestminster3Chapter,
  parseWestminster3StandardChapter,
};
