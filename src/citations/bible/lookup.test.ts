import { describe, expect, it } from "vitest";

import { VerseLookup, isTranslation, normalizeTranslation } from "./lookup.js";

const sampleIndexes = {
  web: {
    "gen.1.1":
      "In the beginning, God created the heavens and the earth.",
    "gen.1.2": "The earth was formless and empty.",
  },
  asv: {
    "gen.1.1":
      "In the beginning God created the heavens and the earth.",
  },
  ylt: {
    "gen.1.1":
      "In the beginning of God's preparing the heavens and the earth --",
  },
} as const;

describe("VerseLookup", () => {
  const lookup = VerseLookup.fromIndexes(sampleIndexes);

  it("returns a verse for a known translation", () => {
    expect(lookup.getVerse("web", "gen", 1, 1)).toContain("beginning");
  });

  it("returns different text per translation", () => {
    expect(lookup.getVerse("asv", "gen", 1, 1)).toContain(
      "In the beginning God created",
    );
    expect(lookup.getVerse("ylt", "gen", 1, 1)).toContain(
      "preparing the heavens",
    );
  });

  it("returns undefined for missing verses", () => {
    expect(lookup.getVerse("web", "gen", 1, 99)).toBeUndefined();
    expect(lookup.getVerse("asv", "gen", 1, 2)).toBeUndefined();
  });

  it("identifies supported translations", () => {
    expect(lookup.hasTranslation("web")).toBe(true);
    expect(lookup.hasTranslation("kjv")).toBe(true);
    expect(lookup.hasTranslation("niv")).toBe(false);
  });

  it("returns chapter verse counts", () => {
    expect(lookup.getChapterVerseCount("web", "gen", 1)).toBe(2);
    expect(lookup.getChapterVerseCount("web", "gen", 99)).toBeUndefined();
  });

  it("expands verses through the end of a chapter", () => {
    expect(lookup.expandVerses("web", "gen", 1, [], 1)).toEqual([1, 2]);
    expect(lookup.expandVerses("web", "gen", 1, [], 2)).toEqual([2]);
  });
});

describe("isTranslation", () => {
  it("accepts translation codes case-insensitively", () => {
    expect(isTranslation("WEB")).toBe(true);
    expect(isTranslation("Asv")).toBe(true);
    expect(isTranslation("kjv")).toBe(true);
    expect(normalizeTranslation("YLT")).toBe("ylt");
    expect(normalizeTranslation("Geneva")).toBe("geneva");
    expect(isTranslation("niv")).toBe(false);
  });
});
