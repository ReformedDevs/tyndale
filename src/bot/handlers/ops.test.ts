import { describe, expect, it } from "vitest";

import {
  buildHelpEmbed,
  buildServerStatusEmbed,
  buildStatusEmbed,
  buildTranslationSetEmbed,
  formatHelpReply,
} from "./ops.js";

describe("formatHelpReply", () => {
  it("includes citation examples and bot commands", () => {
    const reply = formatHelpReply("web", "literary");

    expect(reply).toContain("**Tyndale** · help");
    expect(reply).toContain("`[Gen 1:1]`");
    expect(reply).toContain("`[Ps 150:5-end]`");
    expect(reply).toContain("`[Tyndale help]`");
    expect(reply).toContain("`[Tyndale status]`");
    expect(reply).toContain("`[Tyndale translation asv]`");
    expect(reply).toContain("`[Tyndale format verse]`");
    expect(reply).toContain("WEB, ASV, YLT (bot default: WEB)");
    expect(reply).toContain("Literary, Paragraph, Verse (bot default: Literary)");
  });
});

describe("buildHelpEmbed", () => {
  it("wraps help text in a Tyndale embed", () => {
    const embed = buildHelpEmbed("web", "literary").toJSON();

    expect(embed.color).toBe(0xb59b3c);
    expect(embed.description).toContain("**Tyndale** · help");
  });
});

describe("buildStatusEmbed", () => {
  it("wraps status text in a Tyndale embed", () => {
    const embed = buildStatusEmbed(
      { ws: { ping: 42 } } as never,
      Date.now() - 60_000,
    ).toJSON();

    expect(embed.color).toBe(0xb59b3c);
    expect(embed.description).toContain("**Tyndale** · online");
  });
});

describe("buildServerStatusEmbed", () => {
  it("shows server defaults, overrides, and usage stats", () => {
    const embed = buildServerStatusEmbed({
      guildTranslation: "asv",
      guildDefaultSetAt: "2026-07-29T18:00:00.000Z",
      guildDefaultSetBy: "Charles",
      guildFormat: "verse",
      guildFormatSetAt: "2026-07-29T19:00:00.000Z",
      guildFormatSetBy: "Charles",
      botDefault: "web",
      botDefaultFormat: "literary",
      memberOverrideCount: 2,
      memberFormatOverrideCount: 1,
      citationsTotal: 10,
      citationsThisWeek: 4,
      topBooks: [
        { bookName: "Genesis", count: 3 },
        { bookName: "John", count: 2 },
      ],
    }).toJSON();

    expect(embed.description).toContain("**Tyndale** · server status");
    expect(embed.description).toContain("*Server default translation:* ASV");
    expect(embed.description).toContain("*Set:*");
    expect(embed.description).toContain("by Charles");
    expect(embed.description).toContain("*Server text layout:* Verse");
    expect(embed.description).toContain("*Personal translation overrides:* 2");
    expect(embed.description).toContain("*Personal layout overrides:* 1");
    expect(embed.description).toContain("*Citations this week:* 4");
    expect(embed.description).toContain("*Citations total:* 10");
    expect(embed.description).toContain("*Most cited:* Genesis (3), John (2)");
  });

  it("notes when the server uses the bot default", () => {
    const embed = buildServerStatusEmbed({
      botDefault: "web",
      botDefaultFormat: "literary",
      memberOverrideCount: 0,
      memberFormatOverrideCount: 0,
      citationsTotal: 0,
      citationsThisWeek: 0,
      topBooks: [],
    }).toJSON();

    expect(embed.description).toContain(
      "*Server default translation:* WEB (bot default)",
    );
    expect(embed.description).toContain(
      "*Server text layout:* Literary (bot default)",
    );
    expect(embed.description).toContain("*Most cited:* none yet");
  });
});

describe("buildTranslationSetEmbed", () => {
  it("uses personal copy for the user", () => {
    const embed = buildTranslationSetEmbed("asv").toJSON();

    expect(embed.description).toContain("your default translation");
    expect(embed.description).toContain("your citations");
  });
});
