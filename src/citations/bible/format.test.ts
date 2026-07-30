import { describe, expect, it } from "vitest";

import {
  buildBibleCitationEmbed,
  buildBibleCitationEmbeds,
  buildBibleCitationEmbedsForMany,
  formatCitationFooter,
  formatReferenceLabel,
  resolveBibleCitation,
  splitDiscordMessages,
} from "./format.js";
import { VerseLookup } from "./lookup.js";
import { PoetryLayoutLookup } from "./poetry-layout.js";

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
      "literary",
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
      "literary",
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
      "literary",
    );

    expect(result).toContain("> **1.** Praise Yah!");
    expect(result).toContain("> **3.** Praise him!");
    expect(result).toContain("*Psalms 150:1-3 · WEB*");
  });
});

describe("buildBibleCitationEmbeds layout", () => {
  it("formats psalm verses with poetry line breaks in literary mode", () => {
    const lookup = VerseLookup.fromIndexes({
      web: {
        "ps.23.1": "The LORD is my shepherd.",
        "ps.23.2": "He makes me lie down in green pastures.",
      },
      asv: {},
      ylt: {},
    });
    const poetryLayout = PoetryLayoutLookup.fromIndex({
      "ps.23.1": {
        lines: [
          { indent: 1 as const, text: "The LORD is my shepherd." },
          { indent: 2 as const, text: "I shall not want." },
        ],
      },
      "ps.23.2": {
        lines: [
          { indent: 1 as const, text: "He makes me lie down in green pastures." },
          { indent: 2 as const, text: "He leads me beside still waters." },
        ],
      },
    });

    const result = buildBibleCitationEmbeds(
      {
        kind: "bible",
        raw: "[Ps 23:1-2]",
        book: "ps",
        bookName: "Psalms",
        chapter: 23,
        verses: [1, 2],
      },
      lookup,
      "web",
      "literary",
      poetryLayout,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds[0]?.data.description).toBe(
      "**1** The LORD is my shepherd.\n\u2003\u2003I shall not want.\n**2** He makes me lie down in green pastures.\n\u2003\u2003He leads me beside still waters.",
    );
  });

  it("groups genesis verses into USFM paragraphs in literary mode", () => {
    const lookup = VerseLookup.fromIndexes({
      web: {
        "gen.1.1": "In the beginning, God created the heavens and the earth.",
        "gen.1.2": "The earth was formless and empty.",
        "gen.1.3": "God said, \"Let there be light,\" and there was light.",
      },
      asv: {},
      ylt: {},
    });
    const poetryLayout = PoetryLayoutLookup.fromIndex({
      "gen.1.1": {
        lines: [
          {
            indent: 1 as const,
            text: "In the beginning, God created the heavens and the earth.",
          },
        ],
        paragraphBreakBefore: true,
      },
      "gen.1.2": {
        lines: [{ indent: 1 as const, text: "The earth was formless and empty." }],
      },
      "gen.1.3": {
        lines: [
          {
            indent: 1 as const,
            text: "God said, \"Let there be light,\" and there was light.",
          },
        ],
        paragraphBreakBefore: true,
      },
    });

    const result = buildBibleCitationEmbeds(
      {
        kind: "bible",
        raw: "[Gen 1:1-3]",
        book: "gen",
        bookName: "Genesis",
        chapter: 1,
        verses: [1, 2, 3],
      },
      lookup,
      "web",
      "literary",
      poetryLayout,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds[0]?.data.description).toBe(
      "**1.** In the beginning, God created the heavens and the earth. **2.** The earth was formless and empty.\n\n**3.** God said, \"Let there be light,\" and there was light.",
    );
  });

  it("formats YLT prose one verse per line in literary mode", () => {
    const lookup = VerseLookup.fromIndexes({
      web: {},
      asv: {},
      ylt: {
        "gen.1.1": "In the beginning of God's preparing the heavens and the earth --",
        "gen.1.2": "the earth hath existed waste and void,",
        "gen.1.3": "and God saith, `Let light be;' and light is.",
      },
    });
    const poetryLayout = PoetryLayoutLookup.fromIndex(
      {
        "gen.1.1": {
          lines: [
            {
              indent: 1 as const,
              text: "In the beginning of God's preparing the heavens and the earth --",
            },
          ],
          paragraphBreakBefore: true,
        },
        "gen.1.2": {
          lines: [{ indent: 1 as const, text: "the earth hath existed waste and void," }],
        },
        "gen.1.3": {
          lines: [
            {
              indent: 1 as const,
              text: "and God saith, `Let light be;' and light is.",
            },
          ],
        },
      },
      "ylt",
    );

    const result = buildBibleCitationEmbeds(
      {
        kind: "bible",
        raw: "[YLT Gen 1:1-3]",
        book: "gen",
        bookName: "Genesis",
        chapter: 1,
        verses: [1, 2, 3],
        translation: "ylt",
      },
      lookup,
      "web",
      "literary",
      poetryLayout,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds[0]?.data.description).toBe(
      "**1.** In the beginning of God's preparing the heavens and the earth --\n**2.** the earth hath existed waste and void,\n**3.** and God saith, `Let light be;' and light is.",
    );
  });

  it("formats psalm verses on separate lines without poetry layout data", () => {
    const lookup = VerseLookup.fromIndexes({
      web: {
        "ps.23.1": "The LORD is my shepherd.",
        "ps.23.2": "He makes me lie down in green pastures.",
      },
      asv: {},
      ylt: {},
    });

    const result = buildBibleCitationEmbeds(
      {
        kind: "bible",
        raw: "[Ps 23:1-2]",
        book: "ps",
        bookName: "Psalms",
        chapter: 23,
        verses: [1, 2],
      },
      lookup,
      "web",
      "literary",
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds[0]?.data.description).toBe(
      "**1.** The LORD is my shepherd.\n**2.** He makes me lie down in green pastures.",
    );
  });

  it("formats prose verses on separate lines in verse mode", () => {
    const result = buildBibleCitationEmbeds(
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
      "verse",
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds[0]?.data.description).toContain(
      "**1.** In the beginning",
    );
    expect(result.embeds[0]?.data.description).toContain("\n**2.**");
  });
});

const johnCitation = {
  kind: "bible" as const,
  raw: "[John 3:16]",
  book: "john" as const,
  bookName: "John",
  chapter: 3,
  verses: [16],
};

describe("buildBibleCitationEmbedsForMany", () => {
  it("collates multiple citations into one embed", () => {
    const lookup = VerseLookup.fromIndexes({
      web: {
        "gen.1.1":
          "In the beginning, God created the heavens and the earth.",
        "john.3.16": "For God so loved the world.",
      },
      asv: {},
      ylt: {},
    });

    const result = buildBibleCitationEmbedsForMany(
      [
        {
          kind: "bible",
          raw: "[Gen 1:1]",
          book: "gen",
          bookName: "Genesis",
          chapter: 1,
          verses: [1],
        },
        johnCitation,
      ],
      lookup,
      "web",
    );

    expect(result.embeds).toHaveLength(1);
    expect(result.embeds[0]?.data.description).toContain(
      "In the beginning, God created the heavens and the earth.",
    );
    expect(result.embeds[0]?.data.description).toContain(
      "For God so loved the world.",
    );
    expect(result.embeds[0]?.data.description).toContain("*Genesis 1:1 · WEB*");
    expect(result.embeds[0]?.data.description).toContain("*John 3:16 · WEB*");
    expect(result.threadName).toBe("Genesis 1:1 · John 3:16 · WEB");
  });

  it("delegates a single citation to the existing embed builder", () => {
    const result = buildBibleCitationEmbedsForMany(
      [
        {
          kind: "bible",
          raw: "[Gen 1:1]",
          book: "gen",
          bookName: "Genesis",
          chapter: 1,
          verses: [1],
        },
      ],
      sampleLookup,
      "web",
    );

    expect(result.embeds).toHaveLength(1);
    expect(result.embeds[0]?.data.footer?.text).toBe("Genesis 1:1 · WEB");
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
