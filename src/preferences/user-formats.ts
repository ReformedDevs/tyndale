import { readFile, writeFile } from "node:fs/promises";

import {
  isTextFormat,
  type TextFormat,
} from "../citations/bible/text-format.js";

interface UserFormatPreference {
  format: TextFormat;
  setInGuildId?: string;
}

type UserFormatPreferences = Record<string, UserFormatPreference>;

export class UserFormatStore {
  private preferences: UserFormatPreferences;

  private constructor(
    private readonly filePath: string,
    preferences: UserFormatPreferences,
  ) {
    this.preferences = preferences;
  }

  static async load(filePath: string): Promise<UserFormatStore> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const preferences: UserFormatPreferences = {};

      for (const [userId, value] of Object.entries(parsed)) {
        const preference = parseStoredPreference(value);
        if (preference) {
          preferences[userId] = preference;
        }
      }

      return new UserFormatStore(filePath, preferences);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return new UserFormatStore(filePath, {});
      }

      throw error;
    }
  }

  get(userId: string): TextFormat | undefined {
    return this.preferences[userId]?.format;
  }

  resolve(userId: string, botDefault: TextFormat): TextFormat {
    return this.preferences[userId]?.format ?? botDefault;
  }

  countForGuild(guildId: string): number {
    return Object.values(this.preferences).filter(
      (preference) => preference.setInGuildId === guildId,
    ).length;
  }

  async set(
    userId: string,
    format: TextFormat,
    setInGuildId?: string,
  ): Promise<void> {
    this.preferences[userId] = {
      format,
      ...(setInGuildId ? { setInGuildId } : {}),
    };
    await this.persist();
  }

  async clear(userId: string): Promise<void> {
    delete this.preferences[userId];
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
): UserFormatPreference | undefined {
  if (typeof value === "string" && isTextFormat(value)) {
    return { format: value };
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
    setInGuildId:
      typeof record.setInGuildId === "string" ? record.setInGuildId : undefined,
  };
}
