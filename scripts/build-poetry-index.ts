import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { Translation } from "../src/citations/bible/lookup.js";
import type { PoetryLayoutIndex } from "../src/citations/bible/poetry-layout.js";
import {
  mergePoetryIndexes,
  parseUsfmFile,
  usfmIdToBookSlug,
} from "../src/citations/bible/usfm-poetry-parser.js";

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");

const USFM_SOURCES = {
  web: "https://ebible.org/Scriptures/engwebp_usfm.zip",
  asv: "https://ebible.org/Scriptures/eng-asv_usfm.zip",
  ylt: "https://ebible.org/Scriptures/engylt_usfm.zip",
} as const satisfies Record<Translation, string>;

async function fetchToFile(url: string, filePath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, buffer);
}

async function buildPoetryIndexFromZip(
  translation: Translation,
  zipUrl: string,
  workDir: string,
): Promise<PoetryLayoutIndex> {
  const zipPath = path.join(workDir, `${translation}-usfm.zip`);
  const extractDir = path.join(workDir, translation);

  console.info(`Fetching ${translation.toUpperCase()} USFM...`);
  await fetchToFile(zipUrl, zipPath);
  await mkdir(extractDir, { recursive: true });
  await execFileAsync("unzip", ["-q", zipPath, "-d", extractDir]);

  const files = (await readdir(extractDir)).filter((name) => name.endsWith(".usfm"));
  const indexes: PoetryLayoutIndex[] = [];

  for (const fileName of files) {
    const content = await readFile(path.join(extractDir, fileName), "utf8");
    const idMatch = /^\\id\s+(\S+)/m.exec(content);
    const book = idMatch ? usfmIdToBookSlug(idMatch[1] ?? "") : undefined;

    if (!book) {
      continue;
    }

    console.info(`Parsing ${translation.toUpperCase()} ${fileName} (${book})...`);
    indexes.push(parseUsfmFile(content));
  }

  return mergePoetryIndexes(indexes);
}

async function main(): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "tyndale-usfm-"));

  try {
    for (const [translation, zipUrl] of Object.entries(USFM_SOURCES)) {
      const merged = await buildPoetryIndexFromZip(
        translation as Translation,
        zipUrl,
        tempDir,
      );
      const filePath = path.join(dataDir, `poetry-${translation}.json`);
      await writeFile(filePath, JSON.stringify(merged));
      console.info(
        `Wrote poetry-${translation}.json (${Object.keys(merged).length} verse layouts)`,
      );
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
