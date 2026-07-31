import { describe, expect, it } from "vitest";

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
          { number: 1, text: "One." },
          { number: 2, text: "Two." },
        ],
      },
      {
        number: 2,
        title: "Of God",
        paragraphs: [{ number: 1, text: "Three." }],
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
        paragraphs: [{ number: 2, text: "Church." }],
      },
    ],
  },
};

describe("ConfessionLookup", () => {
  const lookup = ConfessionLookup.fromDocuments(sampleDocuments);

  it("expands a cross-chapter range", () => {
    expect(lookup.expandRange("wcf", 1, 2, 2, 1)).toEqual([
      { chapter: 1, paragraph: 2 },
      { chapter: 2, paragraph: 1 },
    ]);
  });

  it("rejects an inverted range", () => {
    expect(lookup.expandRange("wcf", 2, 1, 1, 1)).toEqual({
      error: "Invalid paragraph range.",
    });
  });

  it("returns proof metadata when present on a paragraph", () => {
    const withProofs = ConfessionLookup.fromDocuments({
      wcf: {
        ...sampleDocuments.wcf,
        chapters: [
          {
            number: 1,
            title: "Of the Holy Scripture",
            paragraphs: [
              {
                number: 1,
                text: "Plain text.",
                textWithMarkers: "Plain text.[1]",
                proofs: [{ marker: 1, references: ["Rom.1.19-20"] }],
              },
            ],
          },
        ],
      },
    });

    expect(withProofs.getParagraph("wcf", 1, 1)).toMatchObject({
      text: "Plain text.",
      textWithMarkers: "Plain text.[1]",
      proofs: [{ marker: 1, references: ["Rom.1.19-20"] }],
    });
  });
});
