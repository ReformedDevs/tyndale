import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  WIKIPEDIA_SOURCE_LABEL,
  fetchWikipediaPage,
  parseWikipediaIntro,
  wikipediaUrl,
} from "../../people/wikipedia.js";
import type { ChurchPersonEntry } from "../../people/types.js";
import {
  parseWikipediaSource,
  type PersonRegistryEntry,
} from "../registry.js";
import type { ContentPaths } from "../../paths.js";

const FETCH_DELAY_MS = 500;

interface RawPersonCache {
  id: string;
  intro: string;
  imageUrl?: string;
}

interface PeopleIndexFile {
  people: ChurchPersonEntry[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function seedFromRegistry(entry: PersonRegistryEntry): Omit<
  ChurchPersonEntry,
  "summary" | "dates" | "imageUrl"
> {
  const wikipediaTitle = parseWikipediaSource(entry.source);
  const aliases = new Set<string>([entry.name, ...(entry.aliases ?? [])]);

  return {
    id: entry.id,
    name: entry.name,
    aliases: [...aliases],
    categories: [...entry.categories].sort(),
    wikipediaTitle,
    wikipediaUrl: wikipediaUrl(wikipediaTitle),
    sourceLabel: WIKIPEDIA_SOURCE_LABEL,
  };
}

function buildEntryFromRaw(
  seed: Omit<ChurchPersonEntry, "summary" | "dates" | "imageUrl">,
  raw: RawPersonCache,
): ChurchPersonEntry {
  const { dates, summary } = parseWikipediaIntro(raw.intro);
  return {
    ...seed,
    dates,
    summary,
    ...(raw.imageUrl ? { imageUrl: raw.imageUrl } : {}),
  };
}

async function readPeopleIndex(indexPath: string): Promise<ChurchPersonEntry[]> {
  try {
    const raw = await readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as PeopleIndexFile;
    return parsed.people ?? [];
  } catch {
    return [];
  }
}

async function writePeopleIndex(
  indexPath: string,
  people: ChurchPersonEntry[],
): Promise<void> {
  const sorted = [...people].sort((left, right) => left.name.localeCompare(right.name));
  await writeFile(indexPath, `${JSON.stringify({ people: sorted }, null, 2)}\n`, "utf8");
}

async function readRawPerson(
  rawDir: string,
  id: string,
): Promise<RawPersonCache | undefined> {
  try {
    const raw = await readFile(path.join(rawDir, `${id}.json`), "utf8");
    return JSON.parse(raw) as RawPersonCache;
  } catch {
    return undefined;
  }
}

async function writeRawPerson(
  rawDir: string,
  entry: RawPersonCache,
): Promise<void> {
  await writeFile(
    path.join(rawDir, `${entry.id}.json`),
    `${JSON.stringify(entry, null, 2)}\n`,
    "utf8",
  );
}

export async function syncPerson(
  entry: PersonRegistryEntry,
  paths: ContentPaths,
): Promise<void> {
  await mkdir(paths.peopleRaw, { recursive: true });
  await mkdir(path.dirname(paths.people), { recursive: true });

  const seed = seedFromRegistry(entry);
  console.info(`Fetching ${seed.name}…`);

  const page = await fetchWikipediaPage(seed.wikipediaTitle);
  const raw: RawPersonCache = {
    id: seed.id,
    intro: page.intro,
    ...(page.imageUrl ? { imageUrl: page.imageUrl } : {}),
  };
  await writeRawPerson(paths.peopleRaw, raw);

  const person = buildEntryFromRaw(seed, raw);
  const people = await readPeopleIndex(paths.people);
  const index = people.findIndex((existing) => existing.id === person.id);
  if (index >= 0) {
    people[index] = person;
  } else {
    people.push(person);
  }

  await writePeopleIndex(paths.people, people);
  console.info(`Updated people/index.json (${people.length} entries)`);

  await sleep(FETCH_DELAY_MS);
}

export async function rebuildPeopleIndexFromRaw(
  registryPeople: PersonRegistryEntry[],
  paths: ContentPaths,
): Promise<void> {
  await mkdir(path.dirname(paths.people), { recursive: true });

  const people: ChurchPersonEntry[] = [];
  for (const entry of registryPeople) {
    const seed = seedFromRegistry(entry);
    const raw = await readRawPerson(paths.peopleRaw, entry.id);
    if (!raw?.intro) {
      throw new Error(`Missing raw biography cache for ${entry.name}`);
    }
    people.push(buildEntryFromRaw(seed, raw));
  }

  await writePeopleIndex(paths.people, people);
  console.info(`Rebuilt people/index.json (${people.length} entries from raw cache)`);
}
