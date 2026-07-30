import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const CREEDS_BASE =
  "https://raw.githubusercontent.com/NonlinearFruit/Creeds.json/master/creeds";

const SOURCES = {
  wcf: {
    file: "westminster_confession_of_faith.json",
    abbrev: "WCF",
  },
  lbcf: {
    file: "london_baptist_1689.json",
    abbrev: "LBCF",
  },
} as const;

type ConfessionId = keyof typeof SOURCES;

interface CreedSection {
  Section: string;
  Content: string;
}

interface CreedChapter {
  Chapter: string;
  Title: string;
  Sections: CreedSection[];
}

interface CreedDocument {
  Metadata: { Title: string };
  Data: CreedChapter[];
}

export interface ConfessionParagraphEntry {
  chapterTitle: string;
  text: string;
}

export interface ConfessionDocument {
  title: string;
  abbrev: string;
  entries: Record<string, ConfessionParagraphEntry>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return (await response.json()) as T;
}

function buildConfessionDocument(
  id: ConfessionId,
  source: CreedDocument,
): ConfessionDocument {
  const entries: Record<string, ConfessionParagraphEntry> = {};

  for (const chapter of source.Data) {
    const chapterNumber = Number.parseInt(chapter.Chapter, 10);
    if (Number.isNaN(chapterNumber)) {
      throw new Error(`Invalid chapter number in ${id}: ${chapter.Chapter}`);
    }

    for (const section of chapter.Sections) {
      const paragraph = Number.parseInt(section.Section, 10);
      if (Number.isNaN(paragraph)) {
        throw new Error(
          `Invalid section number in ${id} chapter ${chapterNumber}: ${section.Section}`,
        );
      }

      const key = `${chapterNumber}:${paragraph}`;
      entries[key] = {
        chapterTitle: chapter.Title,
        text: section.Content.trim(),
      };
    }
  }

  return {
    title: source.Metadata.Title,
    abbrev: SOURCES[id].abbrev,
    entries,
  };
}

async function main(): Promise<void> {
  await mkdir(dataDir, { recursive: true });

  for (const [id, config] of Object.entries(SOURCES) as [
    ConfessionId,
    (typeof SOURCES)[ConfessionId],
  ][]) {
    const url = `${CREEDS_BASE}/${config.file}`;
    const source = await fetchJson<CreedDocument>(url);
    const document = buildConfessionDocument(id, source);
    const outputPath = path.join(dataDir, `${id}.json`);
    await writeFile(outputPath, JSON.stringify(document, null, 2));
    console.log(
      `Wrote ${outputPath} (${Object.keys(document.entries).length} paragraphs)`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
