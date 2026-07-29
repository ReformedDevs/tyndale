import { describe, expect, it } from "vitest";

import {
  buildHelpEmbed,
  buildStatusEmbed,
  formatHelpReply,
} from "./ops.js";

describe("formatHelpReply", () => {
  it("includes citation examples and bot commands", () => {
    const reply = formatHelpReply("web");

    expect(reply).toContain("**Tyndale** · help");
    expect(reply).toContain("`[Gen 1:1]`");
    expect(reply).toContain("`[Ps 150:5-end]`");
    expect(reply).toContain("`[Tyndale help]`");
    expect(reply).toContain("`[Tyndale status]`");
    expect(reply).toContain("WEB, ASV, YLT (default: WEB)");
  });
});

describe("buildHelpEmbed", () => {
  it("wraps help text in a Tyndale embed", () => {
    const embed = buildHelpEmbed("web").toJSON();

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
