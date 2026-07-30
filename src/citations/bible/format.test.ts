import { describe, expect, it } from "vitest";

import {
  buildBibleCitationEmbed,
  buildBibleCitationEmbeds,
  buildBibleCitationEmbedsForMany,
  formatCitationFooter,
  formatReferenceLabel,
  groupDisplayLinesIntoVerseSegments,
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

  it("uses clean verse text instead of USFM strong tags in literary mode", () => {
    const lookup = VerseLookup.fromIndexes({
      web: {
        "rev.1.8":
          "\"I am the Alpha and the Omega,\" says the Lord God, \"who is and who was and who is to come, the Almighty.\"",
        "rev.1.9":
          "I John, your brother and partner with you in the oppression, Kingdom, and perseverance in Christ Jesus, was on the isle that is called Patmos because of God's Word and the testimony of Jesus Christ.",
      },
      asv: {},
      ylt: {},
    });
    const poetryLayout = PoetryLayoutLookup.fromIndex({
      "rev.1.8": {
        lines: [
          {
            indent: 1 as const,
            text: "“ I|strong=\"G1473\" am|strong=\"G1510\" the|strong=\"G2532\" Alpha and|strong=\"G2532\" the|strong=\"G2532\" Omega|strong=\"G5598\", ” says the Lord God",
          },
        ],
        paragraphBreakBefore: true,
      },
      "rev.1.9": {
        lines: [
          {
            indent: 1 as const,
            text: "I John, your brother and partner with you in the oppression, Kingdom, and perseverance in Christ Jesus, was on the isle that is called Patmos because of God's Word and the testimony of Jesus Christ.",
          },
        ],
      },
    });

    const result = buildBibleCitationEmbeds(
      {
        kind: "bible",
        raw: "[Rev 1:8-9]",
        book: "rev",
        bookName: "Revelation",
        chapter: 1,
        verses: [8, 9],
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

    expect(result.embeds[0]?.data.description).not.toContain("strong=");
    expect(result.embeds[0]?.data.description).toContain("Alpha and the Omega");
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

describe("groupDisplayLinesIntoVerseSegments", () => {
  it("keeps multi-line poetry verses together", () => {
    const segments = groupDisplayLinesIntoVerseSegments(
      [
        "**1** Blessed are those whose ways are blameless",
        "\u2003\u2003who walk according to the law of the LORD.",
        "**2** Blessed are those who keep his statutes",
        "\u2003\u2003and seek him with all their heart.",
      ],
      "usfm",
    );

    expect(segments).toEqual([
      "**1** Blessed are those whose ways are blameless\n\u2003\u2003who walk according to the law of the LORD.",
      "**2** Blessed are those who keep his statutes\n\u2003\u2003and seek him with all their heart.",
    ]);
  });

  it("splits combined paragraph lines into individual verses", () => {
    const segments = groupDisplayLinesIntoVerseSegments(
      ["**1.** In the beginning. **2.** The earth was empty."],
      "paragraph",
    );

    expect(segments).toEqual([
      "**1.** In the beginning.",
      "**2.** The earth was empty.",
    ]);
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

  it("splits long poetry chapters at verse boundaries, not mid-verse", () => {
    const webIndex: Record<string, string> = {};
    const poetryIndex: Record<string, { lines: { indent: 1 | 2; text: string }[] }> =
      {};

    for (let verse = 1; verse <= 50; verse += 1) {
      const key = `ps.119.${verse}`;
      webIndex[key] = "fallback";
      poetryIndex[key] = {
        lines: [
          {
            indent: 1,
            text: `Blessed are those whose ways are blameless, verse ${verse}. `.repeat(
              4,
            ),
          },
          {
            indent: 2,
            text: `They also walk according to the law of the LORD, verse ${verse}. `.repeat(
              4,
            ),
          },
        ],
      };
    }

    const lookup = VerseLookup.fromIndexes({ web: webIndex, asv: {}, ylt: {} });
    const poetryLayout = PoetryLayoutLookup.fromIndex(poetryIndex);
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
      "literary",
      poetryLayout,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds.length).toBeGreaterThan(1);

    const continuationLine = /^\u2003/;
    for (const embed of result.embeds) {
      const firstLine = embed.data.description?.split("\n").find((line) => line.length > 0);
      expect(firstLine && continuationLine.test(firstLine)).toBe(false);
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
