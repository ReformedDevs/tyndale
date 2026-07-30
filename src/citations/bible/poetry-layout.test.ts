import { describe, expect, it } from "vitest";

import {
  formatUsfmCitationLines,
  formatPoetryVerseBlock,
  PoetryLayoutLookup,
} from "./poetry-layout.js";

describe("formatPoetryVerseBlock", () => {
  it("bolds the verse number on the first line and indents parallel lines", () => {
    const lines = formatPoetryVerseBlock(1, {
      lines: [
        { indent: 1, text: "Blessed is the man" },
        { indent: 2, text: "nor stand in the way of sinners," },
      ],
    });

    expect(lines[0]).toBe("**1** Blessed is the man");
    expect(lines[1]).toMatch(/^\u2003\u2003nor stand/);
  });
});

describe("formatUsfmCitationLines", () => {
  it("groups prose verses into paragraphs", () => {
    const index = {
      "gen.1.1": {
        lines: [{ indent: 1 as const, text: "In the beginning." }],
        paragraphBreakBefore: true,
      },
      "gen.1.2": {
        lines: [{ indent: 1 as const, text: "The earth was empty." }],
      },
      "gen.1.3": {
        lines: [{ indent: 1 as const, text: "God said let there be light." }],
        paragraphBreakBefore: true,
      },
    };
    const lookup = PoetryLayoutLookup.fromIndex(index);

    const lines = formatUsfmCitationLines(
      [1, 2, 3],
      (verse) => lookup.getVerse("web", "gen", 1, verse),
      () => undefined,
    );

    expect(lines).toEqual([
      "**1.** In the beginning. **2.** The earth was empty.",
      "",
      "**3.** God said let there be light.",
    ]);
  });

  it("puts each prose verse on its own line when proseLayout is verse", () => {
    const index = {
      "gen.1.1": {
        lines: [{ indent: 1 as const, text: "In the beginning." }],
        paragraphBreakBefore: true,
      },
      "gen.1.2": {
        lines: [{ indent: 1 as const, text: "The earth was empty." }],
      },
      "gen.1.3": {
        lines: [{ indent: 1 as const, text: "God said let there be light." }],
        paragraphBreakBefore: true,
      },
    };
    const lookup = PoetryLayoutLookup.fromIndex(index);

    const lines = formatUsfmCitationLines(
      [1, 2, 3],
      (verse) => lookup.getVerse("web", "gen", 1, verse),
      () => undefined,
      { proseLayout: "verse" },
    );

    expect(lines).toEqual([
      "**1.** In the beginning.",
      "**2.** The earth was empty.",
      "**3.** God said let there be light.",
    ]);
  });

  it("inserts stanza breaks between verses", () => {
    const index = {
      "ps.1.1": {
        lines: [{ indent: 1 as const, text: "Blessed is the man" }],
      },
      "ps.1.2": {
        lines: [{ indent: 1 as const, text: "But his delight is in the law." }],
        stanzaBreakAfter: true,
      },
      "ps.1.3": {
        lines: [{ indent: 1 as const, text: "He is like a tree." }],
      },
    };
    const lookup = PoetryLayoutLookup.fromIndex(index);

    const lines = formatUsfmCitationLines(
      [1, 2, 3],
      (verse) => lookup.getVerse("web", "ps", 1, verse),
      () => undefined,
    );

    expect(lines).toEqual([
      "**1.** Blessed is the man **2.** But his delight is in the law.",
      "",
      "**3.** He is like a tree.",
    ]);
  });
});
