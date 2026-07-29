import { describe, expect, it } from "vitest";

import { formatHelpReply } from "./ops.js";

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
