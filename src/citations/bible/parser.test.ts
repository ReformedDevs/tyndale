import { describe, expect, it } from "vitest";

import {
  findBracketCitations,
  parseBracketCitation,
  parseScriptureReference,
} from "./parser.js";

describe("parseBracketCitation", () => {
  it("parses a single verse with abbreviation", () => {
    const result = parseBracketCitation("[Gen 1:1]");
    expect(result).toMatchObject({
      kind: "bible",
      book: "gen",
      chapter: 1,
      verses: [1],
    });
  });

  it("parses a full book name", () => {
    const result = parseBracketCitation("[Genesis 1:1]");
    expect(result).toMatchObject({
      kind: "bible",
      book: "gen",
      bookName: "Genesis",
      verses: [1],
    });
  });

  it("parses an inclusive verse range", () => {
    const result = parseBracketCitation("[Gen 1:1-3]");
    expect(result).toMatchObject({
      kind: "bible",
      verses: [1, 2, 3],
    });
  });

  it("parses comma-separated verses and ranges", () => {
    const result = parseBracketCitation("[Gen 1:1-3,5]");
    expect(result).toMatchObject({
      kind: "bible",
      verses: [1, 2, 3, 5],
    });
  });

  it("parses a translation prefix", () => {
    const result = parseBracketCitation("[ASV Gen 1:1]");
    expect(result).toMatchObject({
      kind: "bible",
      translation: "asv",
      book: "gen",
      verses: [1],
    });
  });

  it("parses numbered books with spaces", () => {
    const result = parseBracketCitation("[1 Cor 13:4]");
    expect(result).toMatchObject({
      kind: "bible",
      book: "1cor",
      chapter: 13,
      verses: [4],
    });
  });

  it("parses status pings", () => {
    expect(parseBracketCitation("[Tyndale status]")).toEqual({
      kind: "status",
      raw: "[Tyndale status]",
    });
  });

  it("parses server status pings", () => {
    expect(parseBracketCitation("[Tyndale server status]")).toEqual({
      kind: "serverStatus",
      raw: "[Tyndale server status]",
    });
  });

  it("parses help pings", () => {
    expect(parseBracketCitation("[Tyndale help]")).toEqual({
      kind: "help",
      raw: "[Tyndale help]",
    });
  });

  it("parses confession citations", () => {
    expect(parseBracketCitation("[WCF 1.1]")).toEqual({
      kind: "confession",
      raw: "[WCF 1.1]",
      confession: "wcf",
      locations: [{ chapter: 1, paragraph: 1 }],
    });
    expect(parseBracketCitation("[LBCF 26.2]")).toEqual({
      kind: "confession",
      raw: "[LBCF 26.2]",
      confession: "lbcf",
      locations: [{ chapter: 26, paragraph: 2 }],
    });
    expect(parseBracketCitation("[WCF 1.1-3]")).toEqual({
      kind: "confession",
      raw: "[WCF 1.1-3]",
      confession: "wcf",
      locations: [],
      range: {
        startChapter: 1,
        startParagraph: 1,
        endChapter: 1,
        endParagraph: 3,
      },
    });
    expect(parseBracketCitation("[LBCF 1.1-2.2]")).toEqual({
      kind: "confession",
      raw: "[LBCF 1.1-2.2]",
      confession: "lbcf",
      locations: [],
      range: {
        startChapter: 1,
        startParagraph: 1,
        endChapter: 2,
        endParagraph: 2,
      },
    });
    expect(parseBracketCitation("[WCF 1]")).toEqual({
      kind: "confession",
      raw: "[WCF 1]",
      confession: "wcf",
      locations: [],
      wholeChapter: 1,
    });
    expect(parseBracketCitation("[LBCF 26.end]")).toEqual({
      kind: "confession",
      raw: "[LBCF 26.end]",
      confession: "lbcf",
      locations: [],
      chapterEndFrom: { chapter: 26, paragraph: 1 },
    });
    expect(parseBracketCitation("[WCF 1.2-end]")).toEqual({
      kind: "confession",
      raw: "[WCF 1.2-end]",
      confession: "wcf",
      locations: [],
      chapterEndFrom: { chapter: 1, paragraph: 2 },
    });
  });

  it("ignores legacy translation preference brackets", () => {
    expect(parseBracketCitation("[Tyndale translation]")).toEqual({
      kind: "ignored",
      raw: "[Tyndale translation]",
    });
    expect(parseBracketCitation("[Tyndale server translation asv]")).toEqual({
      kind: "ignored",
      raw: "[Tyndale server translation asv]",
    });
  });

  it("parses KJV translation prefix on citations", () => {
    expect(parseBracketCitation("[kjv gen 1:1]")).toMatchObject({
      kind: "bible",
      translation: "kjv",
      book: "gen",
    });
  });

  it("parses format preference commands", () => {
    expect(parseBracketCitation("[Tyndale format]")).toEqual({
      kind: "format",
      raw: "[Tyndale format]",
      action: "show",
    });
    expect(parseBracketCitation("[Tyndale format verse]")).toEqual({
      kind: "format",
      raw: "[Tyndale format verse]",
      action: "set",
      format: "verse",
    });
    expect(parseBracketCitation("[Tyndale format reset]")).toEqual({
      kind: "format",
      raw: "[Tyndale format reset]",
      action: "reset",
    });
  });

  it("parses server format preference commands", () => {
    expect(parseBracketCitation("[Tyndale server format]")).toEqual({
      kind: "serverFormat",
      raw: "[Tyndale server format]",
      action: "show",
    });
    expect(parseBracketCitation("[Tyndale server format paragraph]")).toEqual({
      kind: "serverFormat",
      raw: "[Tyndale server format paragraph]",
      action: "set",
      format: "paragraph",
    });
    expect(parseBracketCitation("[Tyndale server format reset]")).toEqual({
      kind: "serverFormat",
      raw: "[Tyndale server format reset]",
      action: "reset",
    });
  });

  it("returns an error for unknown format preferences", () => {
    const result = parseBracketCitation("[Tyndale format block]");
    expect(result).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Unknown format"),
    });
  });

  it("ignores bracket text that is not a citation attempt", () => {
    expect(parseBracketCitation("[hello world]")).toEqual({
      kind: "ignored",
      raw: "[hello world]",
    });
    expect(parseBracketCitation("[see note]")).toEqual({
      kind: "ignored",
      raw: "[see note]",
    });
  });

  it("parses a whole chapter reference", () => {
    const result = parseBracketCitation("[Ps 150]");
    expect(result).toMatchObject({
      kind: "bible",
      book: "ps",
      chapter: 150,
      verses: [],
      chapterEndFrom: 1,
    });
  });

  it("parses chapter references through end", () => {
    expect(parseBracketCitation("[Ps 150:1-end]")).toMatchObject({
      kind: "bible",
      book: "ps",
      chapter: 150,
      chapterEndFrom: 1,
    });
    expect(parseBracketCitation("[Ps 150:5-end]")).toMatchObject({
      kind: "bible",
      book: "ps",
      chapter: 150,
      chapterEndFrom: 5,
    });
    expect(parseBracketCitation("[Ps 150:end]")).toMatchObject({
      kind: "bible",
      book: "ps",
      chapter: 150,
      chapterEndFrom: 1,
    });
  });

  it("returns an error for malformed chapter:verse syntax", () => {
    const result = parseBracketCitation("[Gen 1:3-10:]");
    expect(result).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Invalid citation format"),
    });
  });

  it("returns an error for unknown books with chapter:verse", () => {
    const result = parseBracketCitation("[Foo 1:1]");
    expect(result).toMatchObject({
      kind: "error",
      message: expect.stringContaining('Could not parse book "Foo"'),
    });
  });

  it("returns an error for invalid verse ranges", () => {
    const result = parseBracketCitation("[Gen 1:5-3]");
    expect(result).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Invalid verse range"),
    });
  });

  it("parses citations case-insensitively", () => {
    expect(parseBracketCitation("[gen 1:1]")).toMatchObject({
      kind: "bible",
      book: "gen",
      verses: [1],
    });
    expect(parseBracketCitation("[GENESIS 1:1]")).toMatchObject({
      kind: "bible",
      book: "gen",
    });
    expect(parseBracketCitation("[asv gen 1:1]")).toMatchObject({
      kind: "bible",
      translation: "asv",
      book: "gen",
    });
    expect(parseBracketCitation("[PS 150:5-END]")).toMatchObject({
      kind: "bible",
      book: "ps",
      chapterEndFrom: 5,
    });
    expect(parseBracketCitation("[TYNDALE HELP]")).toMatchObject({
      kind: "help",
    });
  });
});

describe("parseScriptureReference", () => {
  it("parses plain scripture references from devotional headings", () => {
    expect(parseScriptureReference("Joshua 5:12")).toMatchObject({
      kind: "bible",
      book: "josh",
      chapter: 5,
      verses: [12],
    });
  });

  it("parses numbered books and comma-separated verses", () => {
    expect(parseScriptureReference("1 John 3:1,2")).toMatchObject({
      kind: "bible",
      book: "1john",
      chapter: 3,
      verses: [1, 2],
    });
    expect(parseScriptureReference("Psalm 100:2")).toMatchObject({
      kind: "bible",
      book: "ps",
      chapter: 100,
      verses: [2],
    });
  });

  it("returns undefined for invalid references", () => {
    expect(parseScriptureReference("Not a reference")).toBeUndefined();
  });
});

describe("findBracketCitations", () => {
  it("skips non-citation brackets when scanning a message", () => {
    const results = findBracketCitations(
      "See [hello world] and [Gen 1:1] for context.",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "bible", book: "gen" });
  });

  it("returns nothing when all brackets are non-citations", () => {
    expect(findBracketCitations("Just [a note] here.")).toEqual([]);
  });

  it("finds multiple citations in one message", () => {
    const results = findBracketCitations(
      "See [Gen 1:1] and [John 3:16] for context.",
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ kind: "bible", book: "gen" });
    expect(results[1]).toMatchObject({ kind: "bible", book: "john" });
  });

  it("ignores text outside brackets", () => {
    const results = findBracketCitations("No citations here.");
    expect(results).toEqual([]);
  });

  it("ignores bracket refs inside markdown quote blocks", () => {
    const results = findBracketCitations(
      "See [Gen 1:1] in this line.\n> Quoted [John 3:16] here.\n> > Nested [Ps 23:1] too.",
    );

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ kind: "bible", book: "gen" });
  });

  it("ignores citations when the entire message is a quote block", () => {
    expect(findBracketCitations("> [Gen 1:1]")).toEqual([]);
  });
});
