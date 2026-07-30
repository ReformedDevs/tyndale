import { readFile, writeFile } from "node:fs/promises";

import type { TimeOfDay } from "../devotionals/time.js";
import { isValidTimezone } from "../devotionals/time.js";

export interface GuildDevotionalSchedule {
  channelId: string;
  timezone: string;
  morning: TimeOfDay;
  evening: TimeOfDay;
  lastMorningSent?: string;
  lastEveningSent?: string;
  setAt: string;
  setBy: string;
}

type GuildDevotionalPreferences = Record<string, GuildDevotionalSchedule>;

function parsePreferencesFile(
  raw: string,
): GuildDevotionalPreferences {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const preferences: GuildDevotionalPreferences = {};

  for (const [guildId, value] of Object.entries(parsed)) {
    const schedule = parseStoredSchedule(value);
    if (schedule) {
      preferences[guildId] = schedule;
    }
  }

  return preferences;
}

export class GuildDevotionalStore {
  private preferences: GuildDevotionalPreferences;

  private constructor(
    private readonly filePath: string,
    preferences: GuildDevotionalPreferences,
  ) {
    this.preferences = preferences;
  }

  static async load(filePath: string): Promise<GuildDevotionalStore> {
    try {
      const raw = await readFile(filePath, "utf8");
      return new GuildDevotionalStore(
        filePath,
        parsePreferencesFile(raw),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return new GuildDevotionalStore(filePath, {});
      }

      throw error;
    }
  }

  /** Re-read schedules from disk so manual edits apply without restarting the bot. */
  async reload(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.preferences = parsePreferencesFile(raw);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        this.preferences = {};
        return;
      }

      console.warn("Failed to reload guild devotional schedules:", error);
    }
  }

  get(guildId: string): GuildDevotionalSchedule | undefined {
    return this.preferences[guildId];
  }

  entries(): Iterable<[string, GuildDevotionalSchedule]> {
    return Object.entries(this.preferences);
  }

  async set(
    guildId: string,
    schedule: Omit<
      GuildDevotionalSchedule,
      "lastMorningSent" | "lastEveningSent" | "setAt" | "setBy"
    > & {
      setBy: string;
    },
  ): Promise<void> {
    const existing = this.preferences[guildId];
    this.preferences[guildId] = {
      channelId: schedule.channelId,
      timezone: schedule.timezone,
      morning: schedule.morning,
      evening: schedule.evening,
      lastMorningSent: existing?.lastMorningSent,
      lastEveningSent: existing?.lastEveningSent,
      setAt: new Date().toISOString(),
      setBy: schedule.setBy,
    };
    await this.persist();
  }

  async markSent(
    guildId: string,
    slot: "morning" | "evening",
    dateKey: string,
  ): Promise<void> {
    const schedule = this.preferences[guildId];
    if (!schedule) {
      return;
    }

    if (slot === "morning") {
      schedule.lastMorningSent = dateKey;
    } else {
      schedule.lastEveningSent = dateKey;
    }

    await this.persist();
  }

  async clear(guildId: string): Promise<void> {
    delete this.preferences[guildId];
    await this.persist();
  }

  private async persist(): Promise<void> {
    await writeFile(
      this.filePath,
      `${JSON.stringify(this.preferences, null, 2)}\n`,
      "utf8",
    );
  }
}

function parseTimeOfDay(value: unknown): TimeOfDay | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.hour !== "number" ||
    typeof record.minute !== "number" ||
    record.hour < 0 ||
    record.hour > 23 ||
    record.minute < 0 ||
    record.minute > 59
  ) {
    return undefined;
  }

  return { hour: record.hour, minute: record.minute };
}

function parseStoredSchedule(value: unknown): GuildDevotionalSchedule | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const morning = parseTimeOfDay(record.morning);
  const evening = parseTimeOfDay(record.evening);

  if (
    typeof record.channelId !== "string" ||
    typeof record.timezone !== "string" ||
    !isValidTimezone(record.timezone) ||
    !morning ||
    !evening ||
    typeof record.setAt !== "string" ||
    typeof record.setBy !== "string"
  ) {
    return undefined;
  }

  return {
    channelId: record.channelId,
    timezone: record.timezone,
    morning,
    evening,
    lastMorningSent:
      typeof record.lastMorningSent === "string"
        ? record.lastMorningSent
        : undefined,
    lastEveningSent:
      typeof record.lastEveningSent === "string"
        ? record.lastEveningSent
        : undefined,
    setAt: record.setAt,
    setBy: record.setBy,
  };
}
