import { readFile, writeFile } from "node:fs/promises";

import {
  isTextFormat,
  type TextFormat,
} from "../citations/bible/text-format.js";

export interface GuildFormatPreference {
  format: TextFormat;
  setAt: string;
  setBy: string;
}

type GuildFormatPreferences = Record<string, GuildFormatPreference>;

export class GuildFormatStore {
  private preferences: GuildFormatPreferences;

  private constructor(
    private readonly filePath: string,
    preferences: GuildFormatPreferences,
  ) {
    this.preferences = preferences;
  }

  static async load(filePath: string): Promise<GuildFormatStore> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const preferences: GuildFormatPreferences = {};

      for (const [guildId, value] of Object.entries(parsed)) {
        const preference = parseStoredPreference(value);
        if (preference) {
          preferences[guildId] = preference;
        }
      }

      return new GuildFormatStore(filePath, preferences);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return new GuildFormatStore(filePath, {});
      }

      throw error;
    }
  }

  get(guildId: string): TextFormat | undefined {
    return this.preferences[guildId]?.format;
  }

  getPreference(guildId: string): GuildFormatPreference | undefined {
    return this.preferences[guildId];
  }

  async set(
    guildId: string,
    format: TextFormat,
    setBy: string,
  ): Promise<void> {
    this.preferences[guildId] = {
      format,
      setAt: new Date().toISOString(),
      setBy,
    };
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

function parseStoredPreference(
  value: unknown,
): GuildFormatPreference | undefined {
  if (typeof value === "string" && isTextFormat(value)) {
    return {
      format: value,
      setAt: "",
      setBy: "",
    };
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.format !== "string" || !isTextFormat(record.format)) {
    return undefined;
  }

  return {
    format: record.format,
    setAt: typeof record.setAt === "string" ? record.setAt : "",
    setBy: typeof record.setBy === "string" ? record.setBy : "",
  };
}
