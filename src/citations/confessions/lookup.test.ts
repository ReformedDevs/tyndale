import { describe, expect, it } from "vitest";

import { ConfessionLookup, type ConfessionDocument } from "./lookup.js";

const sampleDocuments: Record<"wcf" | "lbcf", ConfessionDocument> = {
  wcf: {
    title: "Westminster Confession of Faith",
    abbrev: "WCF",
    entries: {
      "1:1": { chapterTitle: "Of the Holy Scripture", text: "One." },
      "1:2": { chapterTitle: "Of the Holy Scripture", text: "Two." },
      "2:1": { chapterTitle: "Of God", text: "Three." },
    },
  },
  lbcf: {
    title: "1689 London Baptist Confession",
    abbrev: "LBCF",
    entries: {
      "26:2": { chapterTitle: "Of the Church", text: "Church." },
    },
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
});
