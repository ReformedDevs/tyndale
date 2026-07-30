import { describe, expect, it } from "vitest";

import {
  cleanWikipediaExtract,
  extractDatesFromIntro,
  parseWikipediaIntro,
  parseWikipediaPagePayload,
} from "./wikipedia.js";

describe("cleanWikipediaExtract", () => {
  it("removes numeric citation markers", () => {
    const raw =
      "William Tyndale was an English biblical translator.[1] He was executed in 1536.[2][3]";

    expect(cleanWikipediaExtract(raw)).toBe(
      "William Tyndale was an English biblical translator. He was executed in 1536.",
    );
  });

  it("removes maintenance tags and listen links", () => {
    const raw =
      "Jonathan Edwards (1703–1758) was an American theologian[citation needed] (listen).";

    expect(cleanWikipediaExtract(raw)).toBe(
      "Jonathan Edwards (1703–1758) was an American theologian.",
    );
  });

  it("simplifies pronunciation clutter in the lead sentence", () => {
    const raw =
      "William Tyndale (; sometimes spelled Tynsdale, Tindall; c. 1494 – October 1536) was an English Biblical scholar.";

    expect(cleanWikipediaExtract(raw)).toBe(
      "William Tyndale (c. 1494 – October 1536) was an English Biblical scholar.",
    );
  });
});

describe("extractDatesFromIntro", () => {
  it("extracts a life range from the lead sentence", () => {
    expect(
      extractDatesFromIntro(
        "William Tyndale (sometimes Tyndale; c. 1494 – c. 1536) was an English biblical translator.",
      ),
    ).toBe("c. 1494 – c. 1536");
  });

  it("extracts dates from a secondary parenthetical before was", () => {
    expect(
      extractDatesFromIntro(
        "Anne Askew (sometimes spelled Ayscough), married name Anne Kyme (1521 – 16 July 1546), was an English writer.",
      ),
    ).toBe("1521 – 16 July 1546");
  });

  it("extracts dates from a pronunciation-heavy parenthetical", () => {
    expect(
      extractDatesFromIntro(
        "William Tyndale (; sometimes spelled Tynsdale; c. 1494 – October 1536) was an English Biblical scholar.",
      ),
    ).toBe("c. 1494 – October 1536");
  });
});

describe("parseWikipediaPagePayload", () => {
  it("returns intro and thumbnail url when present", () => {
    expect(
      parseWikipediaPagePayload(
        {
          extract: "William Tyndale (c. 1494 – 1536) was an English translator.",
          thumbnail: {
            source: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tyndale.jpg/400px-Tyndale.jpg",
          },
        },
        "William Tyndale",
      ),
    ).toEqual({
      intro: "William Tyndale (c. 1494 – 1536) was an English translator.",
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Tyndale.jpg/400px-Tyndale.jpg",
    });
  });

  it("returns intro only when no thumbnail exists", () => {
    expect(
      parseWikipediaPagePayload(
        { extract: "Some obscure figure (d. 999) was a Christian." },
        "Some obscure figure",
      ),
    ).toEqual({
      intro: "Some obscure figure (d. 999) was a Christian.",
    });
  });
});

describe("parseWikipediaIntro", () => {
  it("returns cleaned summary and dates together", () => {
    const result = parseWikipediaIntro(
      "Martin Luther (1483 – 1546) was a German priest and theologian.[1] He initiated the Reformation.",
    );

    expect(result.dates).toBe("1483 – 1546");
    expect(result.summary).not.toContain("[1]");
    expect(result.summary).toContain("German priest");
  });
});
