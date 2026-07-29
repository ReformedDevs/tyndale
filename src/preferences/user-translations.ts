import { readFile, writeFile } from "node:fs/promises";

import {
  isTranslation,
  type Translation,
} from "../citations/bible/lookup.js";

type UserTranslationPreferences = Record<string, Translation>;

export class UserTranslationStore {
  private preferences: UserTranslationPreferences;

  private constructor(
    private readonly filePath: string,
    preferences: UserTranslationPreferences,
  ) {
    this.preferences = preferences;
  }

  static async load(filePath: string): Promise<UserTranslationStore> {
    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const preferences: UserTranslationPreferences = {};

      for (const [userId, value] of Object.entries(parsed)) {
        if (typeof value === "string" && isTranslation(value)) {
          preferences[userId] = value;
        }
      }

      return new UserTranslationStore(filePath, preferences);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return new UserTranslationStore(filePath, {});
      }

      throw error;
    }
  }

  get(userId: string): Translation | undefined {
    return this.preferences[userId];
  }

  resolve(userId: string, botDefault: Translation): Translation {
    return this.preferences[userId] ?? botDefault;
  }

  async set(userId: string, translation: Translation): Promise<void> {
    this.preferences[userId] = translation;
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
