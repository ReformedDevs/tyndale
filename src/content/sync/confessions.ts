import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  countConfessionParagraphs,
  type ConfessionDocument,
} from "../../citations/confessions/lookup.js";
import type { ConfessionRegistryEntry } from "../registry.js";
import type { ContentPaths } from "../../paths.js";
import { fetchRemoteText, type RemoteFetchResult } from "./remote.js";

export function validateConfessionSource(
  entry: ConfessionRegistryEntry,
  source: ConfessionDocument,
): void {
  if (source.meta.id !== entry.id) {
    throw new Error(
      `Confession id mismatch for ${entry.id}: source meta.id is "${source.meta.id}"`,
    );
  }

  if (source.meta.abbrev !== entry.abbrev) {
    throw new Error(
      `Confession abbrev mismatch for ${entry.id}: source meta.abbrev is "${source.meta.abbrev}", registry has "${entry.abbrev}"`,
    );
  }
}

export async function syncConfession(
  entry: ConfessionRegistryEntry,
  paths: ContentPaths,
  fetched?: RemoteFetchResult,
): Promise<string> {
  await mkdir(paths.confessions, { recursive: true });

  const remote = fetched ?? (await fetchRemoteText(entry.source));
  console.info(`Fetching ${entry.abbrev} from ${entry.source}...`);

  const source = JSON.parse(remote.body) as ConfessionDocument;
  validateConfessionSource(entry, source);

  const outputPath = path.join(paths.confessions, `${entry.id}.json`);
  await writeFile(outputPath, `${JSON.stringify(source, null, 2)}\n`, "utf8");
  console.info(
    `Wrote confessions/${entry.id}.json (${countConfessionParagraphs(source)} paragraphs)`,
  );

  return remote.contentHash;
}
