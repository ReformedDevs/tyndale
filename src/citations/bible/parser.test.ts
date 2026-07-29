import { describe, expect, it } from "vitest";

import {
  findBracketCitations,
  parseBracketCitation,
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
});
