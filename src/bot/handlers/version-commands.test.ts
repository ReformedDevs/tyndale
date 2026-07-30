import { describe, expect, it, vi } from "vitest";

import type { Config } from "../../config.js";
import { GuildTranslationStore } from "../../preferences/guild-translations.js";
import { UserTranslationStore } from "../../preferences/user-translations.js";
import {
  handleServerVersionCommand,
  handleVersionCommand,
} from "./version-commands.js";

function createInteraction(
  overrides: {
    commandName?: string;
    subcommand?: string;
    subcommandGroup?: string;
    translation?: string;
    guildId?: string | null;
    userId?: string;
  } = {},
) {
  const reply = vi.fn().mockResolvedValue(undefined);

  return {
    commandName: overrides.commandName ?? "version",
    guildId:
      overrides.guildId === undefined ? "guild-1" : overrides.guildId,
    user: { id: overrides.userId ?? "user-1" },
    options: {
      getSubcommand: () => overrides.subcommand ?? "show",
      getSubcommandGroup: () => overrides.subcommandGroup,
      getString: (name: string) =>
        name === "translation" ? overrides.translation : null,
    },
    reply,
  };
}

describe("handleVersionCommand", () => {
  const config = {
    DEFAULT_TRANSLATION: "web",
    DEFAULT_TEXT_FORMAT: "literary",
  } as Config;

  it("sets a user translation", async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const interaction = createInteraction({
      subcommand: "set",
      translation: "kjv",
    });

    await handleVersionCommand(interaction as never, {
      config,
      userTranslations: { set, clear: vi.fn(), get: vi.fn() } as unknown as UserTranslationStore,
      guildTranslations: { get: vi.fn() } as unknown as GuildTranslationStore,
    });

    expect(set).toHaveBeenCalledWith("user-1", "kjv", "guild-1");
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("KJV"),
            }),
          }),
        ],
      }),
    );
  });
});

describe("handleServerVersionCommand", () => {
  const config = {
    DEFAULT_TRANSLATION: "web",
    DEFAULT_TEXT_FORMAT: "literary",
  } as Config;

  it("requires a guild", async () => {
    const interaction = createInteraction({
      commandName: "server",
      subcommandGroup: "version",
      guildId: null,
    });

    await handleServerVersionCommand(interaction as never, {
      config,
      userTranslations: {} as UserTranslationStore,
      guildTranslations: {} as GuildTranslationStore,
    });

    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({ ephemeral: true }),
    );
  });

  it("sets a server translation", async () => {
    const set = vi.fn().mockResolvedValue(undefined);
    const interaction = createInteraction({
      commandName: "server",
      subcommandGroup: "version",
      subcommand: "set",
      translation: "geneva",
    });

    await handleServerVersionCommand(interaction as never, {
      config,
      userTranslations: {} as UserTranslationStore,
      guildTranslations: {
        set,
        get: vi.fn(),
        clear: vi.fn(),
      } as unknown as GuildTranslationStore,
    });

    expect(set).toHaveBeenCalledWith("guild-1", "geneva", "user-1");
    expect(interaction.reply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("GENEVA"),
            }),
          }),
        ],
      }),
    );
  });
});
