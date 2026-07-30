import { readFile, writeFile } from "node:fs/promises";

import { getBookName } from "../citations/bible/parser.js";
import type { BookSlug } from "../citations/bible/books.js";
import type { ParsedBibleCitation } from "../citations/types.js";

interface GuildCitationStats {
  citationsTotal: number;
  weekStart: string;
  citationsThisWeek: number;
  books: Record<string, number>;
}

export interface GuildAnalyticsSummary {
  citationsTotal: number;
  citationsThisWeek: number;
  topBooks: Array<{ bookName: string; count: number }>;
}

type GuildAnalyticsStoreData = Record<string, GuildCitationStats>;

const MILLISECONDS_PER_DAY = 86_400_000;
const TOP_BOOK_LIMIT = 3;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function maybeRollWeek(stats: GuildCitationStats, now = new Date()): void {
  const weekStart = new Date(`${stats.weekStart}T00:00:00.000Z`);
  const daysElapsed = Math.floor(
    (now.getTime() - weekStart.getTime()) / MILLISECONDS_PER_DAY,
  );

  if (daysElapsed >= 7) {
    stats.weekStart = todayUtc();
    stats.citationsThisWeek = 0;
  }
}

function emptyStats(): GuildCitationStats {
  return {
    citationsTotal: 0,
    weekStart: todayUtc(),
    citationsThisWeek: 0,
    books: {},
  };
}

export class GuildAnalyticsStore {
  private stats: GuildAnalyticsStoreData;

  private constructor(
    private readonly filePath: string,
    stats: GuildAnalyticsStoreData,
  ) {
    this.stats = stats;
  }

  static async load(filePath: string): Promise<GuildAnalyticsStore> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const stats: GuildAnalyticsStoreData = {};

      for (const [guildId, value] of Object.entries(parsed)) {
        if (typeof value !== "object" || value === null) {
          continue;
        }

        const record = value as Record<string, unknown>;
        const books: Record<string, number> = {};

        if (typeof record.books === "object" && record.books !== null) {
          for (const [book, count] of Object.entries(record.books)) {
            if (typeof count === "number" && count > 0) {
              books[book] = count;
            }
          }
        }

        stats[guildId] = {
          citationsTotal:
            typeof record.citationsTotal === "number" ? record.citationsTotal : 0,
          weekStart:
            typeof record.weekStart === "string"
              ? record.weekStart
              : todayUtc(),
          citationsThisWeek:
            typeof record.citationsThisWeek === "number"
              ? record.citationsThisWeek
              : 0,
          books,
        };
      }

      return new GuildAnalyticsStore(filePath, stats);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return new GuildAnalyticsStore(filePath, {});
      }

      throw error;
    }
  }

  getSummary(guildId: string): GuildAnalyticsSummary {
    const guildStats = this.stats[guildId];
    if (!guildStats) {
      return {
        citationsTotal: 0,
        citationsThisWeek: 0,
        topBooks: [],
      };
    }

    maybeRollWeek(guildStats);

    const topBooks = Object.entries(guildStats.books)
      .sort((left, right) => right[1] - left[1])
      .slice(0, TOP_BOOK_LIMIT)
      .map(([book, count]) => ({
        bookName: getBookName(book as BookSlug),
        count,
      }));

    return {
      citationsTotal: guildStats.citationsTotal,
      citationsThisWeek: guildStats.citationsThisWeek,
      topBooks,
    };
  }

  async recordCitations(
    guildId: string,
    citations: ParsedBibleCitation[],
  ): Promise<void> {
    if (citations.length === 0) {
      return;
    }

    const guildStats = this.stats[guildId] ?? emptyStats();
    maybeRollWeek(guildStats);

    guildStats.citationsTotal += citations.length;
    guildStats.citationsThisWeek += citations.length;

    for (const citation of citations) {
      guildStats.books[citation.book] =
        (guildStats.books[citation.book] ?? 0) + 1;
    }

    this.stats[guildId] = guildStats;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await writeFile(
      this.filePath,
      `${JSON.stringify(this.stats, null, 2)}\n`,
      "utf8",
    );
  }
}
