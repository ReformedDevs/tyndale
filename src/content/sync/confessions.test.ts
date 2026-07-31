import { describe, expect, it } from "vitest";

import type { ConfessionDocument } from "../../citations/confessions/lookup.js";
import { validateConfessionSource } from "./confessions.js";

const sampleSource: ConfessionDocument = {
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
      paragraphs: [{ number: 1, text: "First paragraph." }],
    },
  ],
};

describe("validateConfessionSource", () => {
  it("accepts matching registry and source metadata", () => {
    expect(() =>
      validateConfessionSource(
        {
          id: "wcf",
          name: "Westminster Confession of Faith",
          abbrev: "WCF",
          source: "https://example.com/wcf.json",
        },
        sampleSource,
      ),
    ).not.toThrow();
  });

  it("rejects source documents whose meta.id does not match the registry entry", () => {
    expect(() =>
      validateConfessionSource(
        {
          id: "wcf",
          name: "Westminster Confession of Faith",
          abbrev: "WCF",
          source: "https://example.com/wcf.json",
        },
        {
          ...sampleSource,
          meta: { ...sampleSource.meta, id: "lbcf" },
        },
      ),
    ).toThrow(/id mismatch/);
  });

  it("rejects source documents whose meta.abbrev does not match the registry entry", () => {
    expect(() =>
      validateConfessionSource(
        {
          id: "wcf",
          name: "Westminster Confession of Faith",
          abbrev: "WCF",
          source: "https://example.com/wcf.json",
        },
        {
          ...sampleSource,
          meta: { ...sampleSource.meta, abbrev: "LBCF" },
        },
      ),
    ).toThrow(/abbrev mismatch/);
  });
});
