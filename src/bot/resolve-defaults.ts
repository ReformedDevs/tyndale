import type { Translation } from "../citations/bible/lookup.js";
import type { TextFormat } from "../citations/bible/text-format.js";
import type { Config } from "../config.js";
import type { GuildFormatStore } from "../preferences/guild-formats.js";
import type { GuildTranslationStore } from "../preferences/guild-translations.js";
import type { UserFormatStore } from "../preferences/user-formats.js";
import type { UserTranslationStore } from "../preferences/user-translations.js";

export interface DefaultPreferenceContext {
  userId: string;
  guildId: string | null;
}

export interface DefaultPreferenceDeps {
  config: Config;
  userTranslations: UserTranslationStore;
  guildTranslations: GuildTranslationStore;
  userFormats: UserFormatStore;
  guildFormats: GuildFormatStore;
}

export function resolveDefaultTranslation(
  context: DefaultPreferenceContext,
  deps: DefaultPreferenceDeps,
): Translation {
  const userTranslation = deps.userTranslations.get(context.userId);
  if (userTranslation) {
    return userTranslation;
  }

  if (context.guildId) {
    const guildTranslation = deps.guildTranslations.get(context.guildId);
    if (guildTranslation) {
      return guildTranslation;
    }
  }

  return deps.config.DEFAULT_TRANSLATION;
}

export function resolveDefaultTextFormat(
  context: DefaultPreferenceContext,
  deps: DefaultPreferenceDeps,
): TextFormat {
  const userFormat = deps.userFormats.get(context.userId);
  if (userFormat) {
    return userFormat;
  }

  if (context.guildId) {
    const guildFormat = deps.guildFormats.get(context.guildId);
    if (guildFormat) {
      return guildFormat;
    }
  }

  return deps.config.DEFAULT_TEXT_FORMAT;
}
