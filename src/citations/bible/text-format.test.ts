import { describe, expect, it } from "vitest";

import {
  formatQuoteBlock,
  formatTextFormatLabel,
  isPoetryBook,
  joinVerseLines,
  normalizeTextFormat,
  resolveVerseLayout,
} from "./text-format.js";

describe("normalizeTextFormat", () => {
  it("accepts canonical format names", () => {
    expect(normalizeTextFormat("literary")).toBe("literary");
    expect(normalizeTextFormat("paragraph")).toBe("paragraph");
    expect(normalizeTextFormat("verse")).toBe("verse");
  });

  it("accepts common aliases", () => {
    expect(normalizeTextFormat("auto")).toBe("literary");
    expect(normalizeTextFormat("lines")).toBe("verse");
  });
});

describe("resolveVerseLayout", () => {
  it("uses paragraph flow for prose in literary mode", () => {
    expect(resolveVerseLayout("literary", "gen")).toBe("paragraph");
  });

  it("uses USFM layout in literary mode when available", () => {
    expect(resolveVerseLayout("literary", "ps", true)).toBe("usfm");
    expect(resolveVerseLayout("literary", "gen", true)).toBe("usfm");
    expect(resolveVerseLayout("literary", "ps", false)).toBe("verse");
    expect(resolveVerseLayout("literary", "gen", false)).toBe("paragraph");
  });

  it("forces paragraph or verse when configured", () => {
    expect(resolveVerseLayout("paragraph", "ps")).toBe("paragraph");
    expect(resolveVerseLayout("verse", "gen")).toBe("verse");
  });
});

describe("joinVerseLines", () => {
  it("joins paragraph layout with spaces", () => {
    expect(joinVerseLines(["**1.** one", "**2.** two"], "paragraph")).toBe(
      "**1.** one **2.** two",
    );
  });

  it("joins verse layout with newlines", () => {
    expect(joinVerseLines(["**1.** one", "**2.** two"], "verse")).toBe(
      "**1.** one\n**2.** two",
    );
  });
});

describe("formatQuoteBlock", () => {
  it("prefixes each line in verse layout", () => {
    expect(
      formatQuoteBlock(["**1.** one", "**2.** two"], "verse"),
    ).toBe("> **1.** one\n> **2.** two");
  });
});

describe("isPoetryBook", () => {
  it("marks wisdom and poetry books", () => {
    expect(isPoetryBook("ps")).toBe(true);
    expect(isPoetryBook("gen")).toBe(false);
  });
});

describe("formatTextFormatLabel", () => {
  it("returns readable labels", () => {
    expect(formatTextFormatLabel("literary")).toBe("Literary");
  });
});
