import { describe, expect, it } from "vitest";

import {
  buildSpurgeonDevotionalEmbeds,
  formatDevotionalParagraphs,
  getDevotionalThreadName,
} from "./format.js";

describe("formatDevotionalParagraphs", () => {
  it("emphasizes the opening epigraph and separates paragraphs", () => {
    const formatted = formatDevotionalParagraphs([
      "“They did eat of the fruit of the land of Canaan that year.”",
      "Israel’s weary wanderings were all over, and the promised rest was attained.",
      "A part of the host will this year tarry on earth.",
    ]);

    expect(formatted).toContain(
      "***“They did eat of the fruit of the land of Canaan that year.”***",
    );
    expect(formatted).not.toContain("> “They did eat");
    expect(formatted).toContain(
      "Israel’s weary wanderings were all over, and the promised rest was attained.",
    );
  });
});

describe("getDevotionalThreadName", () => {
  it("uses the reading title for thread names", () => {
    expect(
      getDevotionalThreadName({
        title: "July 30 -- Morning",
        reference: "Joshua 5:12",
        paragraphs: [],
      }),
    ).toBe("July 30 -- Morning");
  });
});

describe("buildSpurgeonDevotionalEmbeds", () => {
  it("returns a single embed for short devotionals", () => {
    const embeds = buildSpurgeonDevotionalEmbeds({
      title: "January 1 -- Morning",
      reference: "Joshua 5:12",
      paragraphs: ["Short devotional body."],
    });

    expect(embeds).toHaveLength(1);
    expect(embeds[0]?.data.title).toBe("January 1 -- Morning");
    expect(embeds[0]?.data.description).toContain("***Joshua 5:12***");
    expect(embeds[0]?.data.description).toContain("Short devotional body.");
    expect(embeds[0]?.data.footer?.text).toBe(
      "Morning & Evening · C. H. Spurgeon",
    );
  });

  it("emphasizes the reference and epigraph in the description", () => {
    const embeds = buildSpurgeonDevotionalEmbeds({
      title: "January 1 -- Morning",
      reference: "Joshua 5:12",
      paragraphs: [
        "“They did eat of the fruit of the land of Canaan that year.”",
        "Israel’s weary wanderings were all over.",
        "A part of the host will this year tarry on earth.",
      ],
    });

    const description = embeds[0]?.data.description ?? "";
    expect(description).toContain("***Joshua 5:12***");
    expect(description).toContain(
      "***“They did eat of the fruit of the land of Canaan that year.”***",
    );
    expect(description).not.toContain("> ");
  });

  it("splits long devotionals across multiple embeds at paragraph boundaries", () => {
    const embeds = buildSpurgeonDevotionalEmbeds({
      title: "December 31 -- Morning",
      reference: "John 7:37",
      paragraphs: [
        "“In the last day, Jesus stood and cried.”",
        "Blessed are those whose ways are blameless. ".repeat(80),
        "Another paragraph of reflection. ".repeat(80),
      ],
    });

    expect(embeds.length).toBeGreaterThan(1);
    expect(embeds[0]?.data.title).toBe("December 31 -- Morning");
    expect(embeds.at(-1)?.data.footer?.text).toBe(
      "Morning & Evening · C. H. Spurgeon",
    );

    for (const embed of embeds) {
      expect((embed.data.description?.length ?? 0)).toBeLessThanOrEqual(4096);
    }
  });
});
