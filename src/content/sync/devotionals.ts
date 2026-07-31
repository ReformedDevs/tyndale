import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DevotionalRegistryEntry } from "../registry.js";
import type { ContentPaths } from "../../paths.js";
import { fetchRemoteText, type RemoteFetchResult } from "./remote.js";

interface SourceEntry {
  month: number;
  day: number;
  period: "morning" | "evening";
  title: string;
  primary_reference?: {
    raw?: string;
  };
  content_blocks?: string[];
}

interface SourceFile {
  data: SourceEntry[];
}

export async function syncDevotional(
  entry: DevotionalRegistryEntry,
  paths: ContentPaths,
  fetched?: RemoteFetchResult,
): Promise<string> {
  await mkdir(paths.devotionals, { recursive: true });

  const remote = fetched ?? (await fetchRemoteText(entry.source));
  console.info(`Fetching ${entry.name}...`);

  const source = JSON.parse(remote.body) as SourceFile;
  const entries: Record<
    string,
    { title: string; reference: string; paragraphs: string[] }
  > = {};

  for (const devotional of source.data) {
    const key = `${String(devotional.month).padStart(2, "0")}-${String(devotional.day).padStart(2, "0")}-${devotional.period}`;
    const reference = devotional.primary_reference?.raw?.trim() ?? "";
    const paragraphs = (devotional.content_blocks ?? [])
      .map((block) => block.trim())
      .filter(Boolean);

    entries[key] = {
      title: devotional.title,
      reference,
      paragraphs,
    };
  }

  const outputPath = path.join(paths.devotionals, `${entry.id}.json`);
  await writeFile(outputPath, `${JSON.stringify({ entries }, null, 2)}\n`, "utf8");
  console.info(
    `Wrote devotionals/${entry.id}.json (${Object.keys(entries).length} entries)`,
  );

  return remote.contentHash;
}
