import { describe, expect, it } from "vitest";

import {
  buildBibleCitationEmbed,
  buildBibleCitationEmbeds,
  formatCitationFooter,
  formatReferenceLabel,
  resolveBibleCitation,
  splitDiscordMessages,
} from "./format.js";
import { VerseLookup } from "./lookup.js";

const sampleLookup = VerseLookup.fromIndexes({
  web: {
    "gen.1.1":
      "In the beginning, God created the heavens and the earth.",
    "gen.1.2": "The earth was formless and empty.",
  },
  asv: {},
  ylt: {},
});

describe("formatReferenceLabel", () => {
  it("formats a single verse", () => {
    expect(formatReferenceLabel("Genesis", 1, [1])).toBe("Genesis 1:1");
  });

  it("formats a contiguous range", () => {
    expect(formatReferenceLabel("Genesis", 1, [1, 2, 3])).toBe(
      "Genesis 1:1-3",
    );
  });

  it("formats non-contiguous verses", () => {
    expect(formatReferenceLabel("Genesis", 1, [1, 3, 5])).toBe(
      "Genesis 1:1,3,5",
    );
  });
});

describe("resolveBibleCitation", () => {
  it("formats a single verse with markdown", () => {
    const result = resolveBibleCitation(
      {
        kind: "bible",
        raw: "[Gen 1:1]",
        book: "gen",
        bookName: "Genesis",
        chapter: 1,
        verses: [1],
      },
      sampleLookup,
      "web",
    );

    expect(result).toBe(
      "> **1.** In the beginning, God created the heavens and the earth.\n\n*Genesis 1:1 · WEB*",
    );
  });

  it("formats multiple verses in one quote block", () => {
    const result = resolveBibleCitation(
      {
        kind: "bible",
        raw: "[Gen 1:1-2]",
        book: "gen",
        bookName: "Genesis",
        chapter: 1,
        verses: [1, 2],
      },
      sampleLookup,
      "web",
    );

    expect(result).toBe(
      "> **1.** In the beginning, God created the heavens and the earth. **2.** The earth was formless and empty.\n\n*Genesis 1:1-2 · WEB*",
    );
  });

  it("formats missing verses in italics", () => {
    const result = resolveBibleCitation(
      {
        kind: "bible",
        raw: "[Gen 1:99]",
        book: "gen",
        bookName: "Genesis",
        chapter: 1,
        verses: [99],
      },
      sampleLookup,
      "web",
    );

    expect(result).toBe("_Genesis 1:99 not found in WEB_");
  });

  it("resolves a whole chapter through lookup", () => {
    const lookup = VerseLookup.fromIndexes({
      web: {
        "ps.150.1": "Praise Yah!",
        "ps.150.2": "Praise him!",
        "ps.150.3": "Praise him!",
      },
      asv: {},
      ylt: {},
    });

    const result = resolveBibleCitation(
      {
        kind: "bible",
        raw: "[Ps 150]",
        book: "ps",
        bookName: "Psalms",
        chapter: 150,
        verses: [],
        chapterEndFrom: 1,
      },
      lookup,
      "web",
    );

    expect(result).toContain("**1.** Praise Yah!");
    expect(result).toContain("**3.** Praise him!");
    expect(result).toContain("*Psalms 150:1-3 · WEB*");
  });
});

describe("buildBibleCitationEmbed", () => {
  it("builds an embed with verse text and footer", () => {
    const embed = buildBibleCitationEmbed(
      {
        kind: "bible",
        raw: "[Gen 1:1]",
        book: "gen",
        bookName: "Genesis",
        chapter: 1,
        verses: [1],
      },
      sampleLookup,
      "web",
    );

    expect(embed?.data.description).toBe(
      "**1.** In the beginning, God created the heavens and the earth.",
    );
    expect(embed?.data.footer?.text).toBe("Genesis 1:1 · WEB");
  });

  it("returns null for missing verses so callers can fall back to text", () => {
    const embed = buildBibleCitationEmbed(
      {
        kind: "bible",
        raw: "[Gen 1:99]",
        book: "gen",
        bookName: "Genesis",
        chapter: 1,
        verses: [99],
      },
      sampleLookup,
      "web",
    );

    expect(embed).toBeNull();
  });
});

describe("buildBibleCitationEmbeds", () => {
  it("splits long chapters across multiple embeds", () => {
    const webIndex: Record<string, string> = {};
    for (let verse = 1; verse <= 50; verse += 1) {
      webIndex[`ps.119.${verse}`] = "Blessed are those whose ways are blameless. ".repeat(3);
    }

    const lookup = VerseLookup.fromIndexes({ web: webIndex, asv: {}, ylt: {} });
    const result = buildBibleCitationEmbeds(
      {
        kind: "bible",
        raw: "[Ps 119]",
        book: "ps",
        bookName: "Psalms",
        chapter: 119,
        verses: [],
        chapterEndFrom: 1,
      },
      lookup,
      "web",
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds.length).toBeGreaterThan(1);
    expect(result.threadName).toBe("Psalms 119:1-50 · WEB");
    expect(result.embeds.at(-1)?.data.footer?.text).toBe("Psalms 119:1-50 · WEB");
    for (const embed of result.embeds) {
      expect((embed.data.description?.length ?? 0)).toBeLessThanOrEqual(4096);
    }
  });
});

describe("formatCitationFooter", () => {
  it("uses an italic footer with a middle dot", () => {
    expect(formatCitationFooter("Genesis 1:1", "WEB")).toBe(
      "*Genesis 1:1 · WEB*",
    );
  });
});

describe("splitDiscordMessages", () => {
  it("returns a single chunk when under the limit", () => {
    expect(splitDiscordMessages("hello")).toEqual(["hello"]);
  });

  it("splits long content on newlines when possible", () => {
    const line = "x".repeat(1000);
    const content = `${line}\n${line}`;
    const chunks = splitDiscordMessages(content, 1500);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 1500)).toBe(true);
  });
});
