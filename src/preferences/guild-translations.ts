import { readFile, writeFile } from "node:fs/promises";

import {
  isTranslation,
  type Translation,
} from "../citations/bible/lookup.js";

export interface GuildTranslationPreference {
  translation: Translation;
  setAt: string;
  setBy: string;
}

type GuildTranslationPreferences = Record<string, GuildTranslationPreference>;

export class GuildTranslationStore {
  private preferences: GuildTranslationPreferences;

  private constructor(
    private readonly filePath: string,
    preferences: GuildTranslationPreferences,
  ) {
    this.preferences = preferences;
  }

  static async load(filePath: string): Promise<GuildTranslationStore> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const preferences: GuildTranslationPreferences = {};

      for (const [guildId, value] of Object.entries(parsed)) {
        const preference = parseStoredPreference(value);
        if (preference) {
          preferences[guildId] = preference;
        }
      }

      return new GuildTranslationStore(filePath, preferences);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return new GuildTranslationStore(filePath, {});
      }

      throw error;
    }
  }

  get(guildId: string): Translation | undefined {
    return this.preferences[guildId]?.translation;
  }

  getPreference(guildId: string): GuildTranslationPreference | undefined {
    return this.preferences[guildId];
  }

  async set(
    guildId: string,
    translation: Translation,
    setBy: string,
  ): Promise<void> {
    this.preferences[guildId] = {
      translation,
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
): GuildTranslationPreference | undefined {
  if (typeof value === "string" && isTranslation(value)) {
    return {
      translation: value,
      setAt: "",
      setBy: "",
    };
  }

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.translation !== "string" ||
    !isTranslation(record.translation)
  ) {
    return undefined;
  }

  return {
    translation: record.translation,
    setAt: typeof record.setAt === "string" ? record.setAt : "",
    setBy: typeof record.setBy === "string" ? record.setBy : "",
  };
}
