import { describe, expect, it } from "vitest";

import type { Config } from "../config.js";
import { GuildFormatStore } from "../preferences/guild-formats.js";
import { GuildTranslationStore } from "../preferences/guild-translations.js";
import { UserFormatStore } from "../preferences/user-formats.js";
import { UserTranslationStore } from "../preferences/user-translations.js";
import {
  resolveDefaultTextFormat,
  resolveDefaultTranslation,
} from "./resolve-defaults.js";

describe("resolveDefaultTranslation", () => {
  const config = {
    DEFAULT_TRANSLATION: "web",
    DEFAULT_TEXT_FORMAT: "literary",
  } as Config;

  const deps = {
    config,
    userTranslations: {
      get: () => undefined,
    } as unknown as UserTranslationStore,
    guildTranslations: {
      get: () => undefined,
    } as unknown as GuildTranslationStore,
    userFormats: {
      get: () => undefined,
    } as unknown as UserFormatStore,
    guildFormats: {
      get: () => undefined,
    } as unknown as GuildFormatStore,
  };

  it("prefers user, then guild, then bot default", () => {
    expect(
      resolveDefaultTranslation({ userId: "u1", guildId: "g1" }, deps),
    ).toBe("web");

    const withGuild = {
      ...deps,
      guildTranslations: {
        get: (guildId: string) => (guildId === "g1" ? "kjv" : undefined),
      } as unknown as GuildTranslationStore,
    };
    expect(
      resolveDefaultTranslation({ userId: "u1", guildId: "g1" }, withGuild),
    ).toBe("kjv");

    const withUser = {
      ...withGuild,
      userTranslations: {
        get: () => "ylt",
      } as unknown as UserTranslationStore,
    };
    expect(
      resolveDefaultTranslation({ userId: "u1", guildId: "g1" }, withUser),
    ).toBe("ylt");
  });
});

describe("resolveDefaultTextFormat", () => {
  const config = {
    DEFAULT_TRANSLATION: "web",
    DEFAULT_TEXT_FORMAT: "literary",
  } as Config;

  it("prefers user format overrides", () => {
    const deps = {
      config,
      userTranslations: {} as UserTranslationStore,
      guildTranslations: {} as GuildTranslationStore,
      userFormats: {
        get: () => "verse",
      } as unknown as UserFormatStore,
      guildFormats: {
        get: () => "paragraph",
      } as unknown as GuildFormatStore,
    };

    expect(
      resolveDefaultTextFormat({ userId: "u1", guildId: "g1" }, deps),
    ).toBe("verse");
  });
});
