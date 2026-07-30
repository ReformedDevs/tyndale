import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WIKIPEDIA_SOURCE_LABEL,
  fetchWikipediaPage,
  parseWikipediaIntro,
  wikipediaUrl,
} from "../src/people/wikipedia.js";

const FETCH_DELAY_MS = 500;

const SEED_FILES = ["reformers", "puritans", "martyrs"] as const;
type SeedFileName = (typeof SEED_FILES)[number];
type PersonCategory = "reformer" | "puritan" | "martyr";

const SEED_FILE_TO_CATEGORY: Record<SeedFileName, PersonCategory> = {
  reformers: "reformer",
  puritans: "puritan",
  martyrs: "martyr",
};

interface SeedEntry {
  id: string;
  name: string;
  aliases?: string[];
  wikipediaTitle: string;
}

interface LegacyChurchPersonEntry {
  id: string;
  name: string;
  aliases: string[];
  categories: PersonCategory[];
  wikipediaTitle?: string;
  wikipediaUrl?: string;
  wikisourceTitle?: string;
  wikisourceUrl?: string;
  sourceLabel: string;
  dates?: string;
  summary?: string;
  imageUrl?: string;
  text?: string;
}

export interface ChurchPersonEntry {
  id: string;
  name: string;
  aliases: string[];
  categories: PersonCategory[];
  wikipediaTitle: string;
  wikipediaUrl: string;
  sourceLabel: string;
  dates?: string;
  summary: string;
  imageUrl?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const seedsDir = path.join(rootDir, "data", "seeds");
const dataDir = path.join(rootDir, "data");
const outputPath = path.join(dataDir, "church-people.json");
const rawCachePath = path.join(dataDir, "church-people-raw.json");

interface RawCacheEntry {
  id: string;
  intro: string;
  imageUrl?: string;
}

interface LegacyRawCacheEntry {
  id: string;
  text?: string;
  intro?: string;
  imageUrl?: string;
}

async function loadRawCache(): Promise<Map<string, RawCacheEntry>> {
  try {
    const raw = await readFile(rawCachePath, "utf8");
    const parsed = JSON.parse(raw) as { people: LegacyRawCacheEntry[] };
    return new Map(
      parsed.people.map((entry) => [
        entry.id,
        {
          id: entry.id,
          intro: entry.intro ?? entry.text ?? "",
          imageUrl: entry.imageUrl,
        },
      ]),
    );
  } catch {
    return new Map();
  }
}

async function saveRawCache(cache: Map<string, RawCacheEntry>): Promise<void> {
  const people = [...cache.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  await writeFile(rawCachePath, `${JSON.stringify({ people }, null, 2)}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function loadSeeds(): Promise<
  Map<string, Omit<ChurchPersonEntry, "summary" | "dates" | "imageUrl">>
> {
  const merged = new Map<
    string,
    Omit<ChurchPersonEntry, "summary" | "dates" | "imageUrl">
  >();

  for (const seedFile of SEED_FILES) {
    const category = SEED_FILE_TO_CATEGORY[seedFile];
    const filePath = path.join(seedsDir, `${seedFile}.json`);
    const raw = await readFile(filePath, "utf8");
    const entries = JSON.parse(raw) as SeedEntry[];

    for (const entry of entries) {
      const aliases = new Set<string>([entry.name, ...(entry.aliases ?? [])]);
      const existing = merged.get(entry.id);

      if (existing) {
        for (const alias of aliases) {
          existing.aliases.push(alias);
        }

        if (!existing.categories.includes(category)) {
          existing.categories.push(category);
        }

        if (existing.wikipediaTitle !== entry.wikipediaTitle) {
          throw new Error(
            `Conflicting Wikipedia titles for ${entry.id}: ${existing.wikipediaTitle} vs ${entry.wikipediaTitle}`,
          );
        }

        continue;
      }

      merged.set(entry.id, {
        id: entry.id,
        name: entry.name,
        aliases: [...aliases],
        categories: [category],
        wikipediaTitle: entry.wikipediaTitle,
        wikipediaUrl: wikipediaUrl(entry.wikipediaTitle),
        sourceLabel: WIKIPEDIA_SOURCE_LABEL,
      });
    }
  }

  for (const entry of merged.values()) {
    entry.aliases = [...new Set(entry.aliases)];
    entry.categories.sort();
  }

  return merged;
}

function buildEntryFromRaw(
  seed: Omit<ChurchPersonEntry, "summary" | "dates" | "imageUrl">,
  raw: RawCacheEntry,
): ChurchPersonEntry {
  const { dates, summary } = parseWikipediaIntro(raw.intro);
  return {
    ...seed,
    dates,
    summary,
    ...(raw.imageUrl ? { imageUrl: raw.imageUrl } : {}),
  };
}

async function readExistingPeople(): Promise<ChurchPersonEntry[]> {
  try {
    const existingRaw = await readFile(outputPath, "utf8");
    const existing = JSON.parse(existingRaw) as {
      people: LegacyChurchPersonEntry[];
    };
    return existing.people as ChurchPersonEntry[];
  } catch {
    return [];
  }
}

async function main(): Promise<void> {
  await mkdir(dataDir, { recursive: true });

  const resummarizeFromRaw = process.argv.includes("--resummarize-from-raw");
  const rebuildAll = process.argv.includes("--rebuild");
  const fetchImagesOnly = process.argv.includes("--fetch-images");
  const refetchIdsArg = process.argv.find((arg) => arg.startsWith("--refetch-ids="));
  const refetchIds = refetchIdsArg
    ? new Set(refetchIdsArg.slice("--refetch-ids=".length).split(",").filter(Boolean))
    : undefined;

  const seeds = await loadSeeds();

  if (fetchImagesOnly) {
    const rawCache = await loadRawCache();
    let people = await readExistingPeople();

    if (people.length === 0) {
      throw new Error(`No existing index at ${outputPath}. Run with --rebuild first.`);
    }

    for (const person of [...people].sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const seed = seeds.get(person.id);
      if (!seed) {
        continue;
      }

      console.log(`Fetching image for ${person.name}…`);
      const page = await fetchWikipediaPage(seed.wikipediaTitle);
      const cached = rawCache.get(person.id);
      rawCache.set(person.id, {
        id: person.id,
        intro: cached?.intro ?? page.intro,
        imageUrl: page.imageUrl,
      });
      await saveRawCache(rawCache);

      person.imageUrl = page.imageUrl;
      await sleep(FETCH_DELAY_MS);
    }

    people.sort((left, right) => left.name.localeCompare(right.name));
    await writeFile(outputPath, `${JSON.stringify({ people }, null, 2)}\n`);
    const withImages = people.filter((person) => person.imageUrl).length;
    console.log(`Updated images for ${people.length} entries (${withImages} with thumbnails)`);
    return;
  }

  if (refetchIds && refetchIds.size > 0) {
    const rawCache = await loadRawCache();
    let people = await readExistingPeople();

    for (const id of refetchIds) {
      const seed = seeds.get(id);
      if (!seed) {
        throw new Error(`Unknown person id for refetch: ${id}`);
      }

      console.log(`Refetching ${seed.name}…`);
      const page = await fetchWikipediaPage(seed.wikipediaTitle);
      rawCache.set(seed.id, { id: seed.id, intro: page.intro, imageUrl: page.imageUrl });
      await saveRawCache(rawCache);

      const entry = buildEntryFromRaw(seed, rawCache.get(seed.id)!);
      const index = people.findIndex((person) => person.id === seed.id);
      if (index >= 0) {
        people[index] = entry;
      } else {
        people.push(entry);
      }

      people.sort((left, right) => left.name.localeCompare(right.name));
      await writeFile(outputPath, `${JSON.stringify({ people }, null, 2)}\n`);
      await sleep(FETCH_DELAY_MS);
    }

    console.log(`Refetched ${refetchIds.size} entr${refetchIds.size === 1 ? "y" : "ies"}`);
    return;
  }

  if (resummarizeFromRaw) {
    const rawCache = await loadRawCache();
    if (rawCache.size === 0) {
      throw new Error(
        `No raw biography cache at ${rawCachePath}. Run with --rebuild first.`,
      );
    }

    const people = [...seeds.values()]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((seed) => {
        const raw = rawCache.get(seed.id);
        if (!raw?.intro) {
          throw new Error(`Missing raw biography text for ${seed.name}`);
        }
        return buildEntryFromRaw(seed, raw);
      });

    await writeFile(outputPath, `${JSON.stringify({ people }, null, 2)}\n`);
    console.log(`Resummarized ${people.length} entries from raw cache`);
    return;
  }

  const seedFiles = await readdir(seedsDir);
  const missing = SEED_FILES.filter(
    (seedFile) => !seedFiles.includes(`${seedFile}.json`),
  );
  if (missing.length > 0) {
    throw new Error(`Missing seed files: ${missing.join(", ")}`);
  }

  const people: ChurchPersonEntry[] = [];

  if (!rebuildAll) {
    try {
      const existingRaw = await readFile(outputPath, "utf8");
      const existing = JSON.parse(existingRaw) as {
        people: LegacyChurchPersonEntry[];
      };
      const rawCache = await loadRawCache();
      for (const person of existing.people) {
        const seed = seeds.get(person.id);
        const raw = rawCache.get(person.id);
        if (seed && raw?.intro) {
          people.push(buildEntryFromRaw(seed, raw));
        }
      }
    } catch {
      // No partial index yet.
    }
  }

  const fetchedIds = new Set(people.map((person) => person.id));
  const rawCache = rebuildAll ? new Map<string, RawCacheEntry>() : await loadRawCache();

  for (const seed of [...seeds.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    if (fetchedIds.has(seed.id)) {
      console.log(`Skipping ${seed.name} (already indexed)`);
      continue;
    }

    console.log(`Fetching ${seed.name}…`);
    const page = await fetchWikipediaPage(seed.wikipediaTitle);
    rawCache.set(seed.id, { id: seed.id, intro: page.intro, imageUrl: page.imageUrl });
    await saveRawCache(rawCache);
    people.push(buildEntryFromRaw(seed, rawCache.get(seed.id)!));
    fetchedIds.add(seed.id);
    people.sort((left, right) => left.name.localeCompare(right.name));
    await writeFile(outputPath, `${JSON.stringify({ people }, null, 2)}\n`);
    await sleep(FETCH_DELAY_MS);
  }

  await writeFile(outputPath, `${JSON.stringify({ people }, null, 2)}\n`);
  const withImages = people.filter((person) => person.imageUrl).length;
  console.log(
    `Wrote ${people.length} church biography entries to ${outputPath} (${withImages} with thumbnails)`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
