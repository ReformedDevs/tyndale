import { describe, expect, it } from "vitest";

import { buildConfessionCitationEmbeds } from "./format.js";
import { ConfessionLookup, type ConfessionDocument } from "./lookup.js";

const sampleDocuments: Record<"wcf" | "lbcf", ConfessionDocument> = {
  wcf: {
    meta: {
      id: "wcf",
      kind: "confession",
      abbrev: "WCF",
      title: "Westminster Confession of Faith",
    },
    chapters: [
      {
        number: 1,
        title: "Of the Holy Scripture",
        paragraphs: [
          { number: 1, text: "First paragraph." },
          { number: 2, text: "Second paragraph." },
        ],
      },
      {
        number: 2,
        title: "Of God",
        paragraphs: [
          { number: 1, text: "Chapter two paragraph one." },
          { number: 2, text: "Chapter two paragraph two." },
        ],
      },
    ],
  },
  lbcf: {
    meta: {
      id: "lbcf",
      kind: "confession",
      abbrev: "LBCF",
      title: "1689 London Baptist Confession",
    },
    chapters: [
      {
        number: 26,
        title: "Of the Church",
        paragraphs: [{ number: 2, text: "Church paragraph two." }],
      },
    ],
  },
};

describe("buildConfessionCitationEmbeds", () => {
  const lookup = ConfessionLookup.fromDocuments(sampleDocuments);

  it("builds a single-section embed with a section header", () => {
    const result = buildConfessionCitationEmbeds(
      {
        kind: "confession",
        raw: "[WCF 1.1]",
        confession: "wcf",
        locations: [{ chapter: 1, paragraph: 1 }],
      },
      lookup,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds).toHaveLength(1);
    expect(result.embeds[0]?.data.description).toBe(
      "__**Westminster Confession of Faith**__\n\n__**1.1. Of the Holy Scripture**__\n\nFirst paragraph.",
    );
  });

  it("uses one chapter header for a same-chapter range", () => {
    const result = buildConfessionCitationEmbeds(
      {
        kind: "confession",
        raw: "[WCF 1.1-2]",
        confession: "wcf",
        locations: [],
        range: {
          startChapter: 1,
          startParagraph: 1,
          endChapter: 1,
          endParagraph: 2,
        },
      },
      lookup,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds[0]?.data.description).toContain("**1.** First paragraph.");
    expect(result.embeds[0]?.data.description).toContain("**2.** Second paragraph.");
  });

  it("uses a chapter header for each chapter in a cross-chapter range", () => {
    const result = buildConfessionCitationEmbeds(
      {
        kind: "confession",
        raw: "[WCF 1.2-2.1]",
        confession: "wcf",
        locations: [],
        range: {
          startChapter: 1,
          startParagraph: 2,
          endChapter: 2,
          endParagraph: 1,
        },
      },
      lookup,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds[0]?.data.description).toContain(
      "__**1. Of the Holy Scripture**__",
    );
    expect(result.embeds[0]?.data.description).toContain("**2.** Second paragraph.");
    expect(result.embeds[0]?.data.description).toContain(
      "__**2. Of God**__",
    );
    expect(result.embeds[0]?.data.description).toContain(
      "**1.** Chapter two paragraph one.",
    );
  });

  it("returns an error for an out-of-range paragraph", () => {
    const result = buildConfessionCitationEmbeds(
      {
        kind: "confession",
        raw: "[LBCF 26.9]",
        confession: "lbcf",
        locations: [{ chapter: 26, paragraph: 9 }],
      },
      lookup,
    );

    expect(result).toEqual({
      error: "Paragraph 9 is beyond chapter 26 in LBCF.",
    });
  });

  it("uses one chapter header for a whole chapter", () => {
    const result = buildConfessionCitationEmbeds(
      {
        kind: "confession",
        raw: "[WCF 1]",
        confession: "wcf",
        locations: [],
        wholeChapter: 1,
      },
      lookup,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds[0]?.data.description).toContain(
      "__**Westminster Confession of Faith**__",
    );
    expect(result.embeds[0]?.data.description).toContain(
      "__**1. Of the Holy Scripture**__",
    );
    expect(result.embeds[0]?.data.description).toContain("**1.** First paragraph.");
    expect(result.embeds[0]?.data.description).toContain("**2.** Second paragraph.");
  });

  it("splits a long whole chapter across multiple embeds", () => {
    const longLookup = ConfessionLookup.fromDocuments({
      ...sampleDocuments,
      wcf: {
        meta: {
          id: "wcf",
          kind: "confession",
          abbrev: "WCF",
          title: "Westminster Confession of Faith",
        },
        chapters: [
          {
            number: 1,
            title: "Of the Holy Scripture",
            paragraphs: [
              { number: 1, text: "A".repeat(2500) },
              { number: 2, text: "B".repeat(2500) },
            ],
          },
        ],
      },
    });

    const result = buildConfessionCitationEmbeds(
      {
        kind: "confession",
        raw: "[WCF 1]",
        confession: "wcf",
        locations: [],
        wholeChapter: 1,
      },
      longLookup,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds.length).toBeGreaterThan(1);
  });

  it("uses a section header when only one paragraph is cited through end", () => {
    const result = buildConfessionCitationEmbeds(
      {
        kind: "confession",
        raw: "[WCF 1.2-end]",
        confession: "wcf",
        locations: [],
        chapterEndFrom: { chapter: 1, paragraph: 2 },
      },
      lookup,
    );

    expect("error" in result).toBe(false);
    if ("error" in result) {
      return;
    }

    expect(result.embeds[0]?.data.description).toBe(
      "__**Westminster Confession of Faith**__\n\n__**1.2. Of the Holy Scripture**__\n\nSecond paragraph.",
    );
  });
});
