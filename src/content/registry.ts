import { readFile } from "node:fs/promises";
import path from "node:path";

import type { PersonCategory } from "../people/types.js";

export interface TranslationRegistryEntry {
  id: string;
  name: string;
  source: string;
  poetrySource: string;
}

export interface PersonRegistryEntry {
  id: string;
  name: string;
  aliases?: string[];
  categories: PersonCategory[];
  source: string;
}

export interface ConfessionRegistryEntry {
  id: string;
  name: string;
  abbrev: string;
  source: string;
}

export interface DevotionalRegistryEntry {
  id: string;
  name: string;
  source: string;
}

export interface ContentRegistry {
  translations: TranslationRegistryEntry[];
  people: PersonRegistryEntry[];
  confessions: ConfessionRegistryEntry[];
  devotionals: DevotionalRegistryEntry[];
}

async function readRegistryFile<T>(registryDir: string, fileName: string): Promise<T[]> {
  const filePath = path.join(registryDir, fileName);
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw) as T[];
}

export async function loadContentRegistry(
  registryDir: string,
): Promise<ContentRegistry> {
  const [translations, people, confessions, devotionals] = await Promise.all([
    readRegistryFile<TranslationRegistryEntry>(registryDir, "translations.json"),
    readRegistryFile<PersonRegistryEntry>(registryDir, "people.json"),
    readRegistryFile<ConfessionRegistryEntry>(registryDir, "confessions.json"),
    readRegistryFile<DevotionalRegistryEntry>(registryDir, "devotionals.json"),
  ]);

  return { translations, people, confessions, devotionals };
}

export function parseWikipediaSource(source: string): string {
  const prefix = "wikipedia:";
  if (!source.startsWith(prefix)) {
    throw new Error(`Unsupported people source (expected wikipedia:…): ${source}`);
  }

  const title = source.slice(prefix.length).trim();
  if (!title) {
    throw new Error("Wikipedia source title is empty");
  }

  return title;
}

export function translationSyncFingerprint(entry: TranslationRegistryEntry): string {
  return JSON.stringify({
    source: entry.source,
    poetrySource: entry.poetrySource,
  });
}

export function entrySyncFingerprint(source: string): string {
  return JSON.stringify({ source });
}
