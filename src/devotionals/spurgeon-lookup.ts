import { readFile } from "node:fs/promises";
import path from "node:path";

export type DevotionalPeriod = "morning" | "evening";

export interface SpurgeonDevotionalEntry {
  title: string;
  reference: string;
  paragraphs: string[];
}

interface SpurgeonIndexFile {
  entries: Record<string, SpurgeonDevotionalEntry | LegacySpurgeonEntry>;
}

interface LegacySpurgeonEntry {
  title: string;
  reference: string;
  body?: string;
  paragraphs?: string[];
}

function entryKey(
  month: number,
  day: number,
  period: DevotionalPeriod,
): string {
  return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-${period}`;
}

function normalizeEntry(
  entry: SpurgeonDevotionalEntry | LegacySpurgeonEntry,
): SpurgeonDevotionalEntry | undefined {
  if (entry.paragraphs?.length) {
    return {
      title: entry.title,
      reference: entry.reference,
      paragraphs: entry.paragraphs,
    };
  }

  if ("body" in entry && entry.body) {
    return {
      title: entry.title,
      reference: entry.reference,
      paragraphs: entry.body
        .split(/\n\n+/)
        .map((part: string) => part.trim())
        .filter(Boolean),
    };
  }

  return undefined;
}

export class SpurgeonDevotionalLookup {
  private constructor(private readonly entries: Record<string, SpurgeonDevotionalEntry>) {}

  static async load(devotionalsDir: string): Promise<SpurgeonDevotionalLookup> {
    const filePath = path.join(devotionalsDir, "spurgeon-morn-eve.json");
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as SpurgeonIndexFile;
    const entries: Record<string, SpurgeonDevotionalEntry> = {};

    for (const [key, value] of Object.entries(parsed.entries ?? {})) {
      const normalized = normalizeEntry(value);
      if (normalized) {
        entries[key] = normalized;
      }
    }

    return new SpurgeonDevotionalLookup(entries);
  }

  get(
    month: number,
    day: number,
    period: DevotionalPeriod,
  ): SpurgeonDevotionalEntry | undefined {
    return this.entries[entryKey(month, day, period)];
  }
}
