import { describe, expect, it } from "vitest";

import { ChurchPeopleLookup } from "./lookup.js";
import type { ChurchPersonEntry } from "./types.js";

const samplePeople: ChurchPersonEntry[] = [
  {
    id: "william-tyndale",
    name: "William Tyndale",
    aliases: ["Tyndale"],
    categories: ["reformer", "martyr"],
    wikipediaTitle: "William Tyndale",
    wikipediaUrl: "https://en.wikipedia.org/wiki/William_Tyndale",
    sourceLabel: "Wikipedia (CC BY-SA 4.0)",
    dates: "c. 1494–1536",
    summary: "Tyndale translated the Bible into English.",
  },
  {
    id: "john-owen",
    name: "John Owen",
    aliases: ["Owen"],
    categories: ["puritan"],
    wikipediaTitle: "John Owen (theologian)",
    wikipediaUrl: "https://en.wikipedia.org/wiki/John_Owen_(theologian)",
    sourceLabel: "Wikipedia (CC BY-SA 4.0)",
    summary: "Owen was a leading Independent divine.",
  },
];

describe("ChurchPeopleLookup", () => {
  const lookup = ChurchPeopleLookup.fromPeople(samplePeople);

  it("finds an exact name match", () => {
    expect(lookup.search("William Tyndale").map((person) => person.id)).toEqual([
      "william-tyndale",
    ]);
  });

  it("finds a surname alias", () => {
    expect(lookup.search("Tyndale")[0]?.id).toBe("william-tyndale");
  });

  it("returns nothing for unknown people", () => {
    expect(lookup.search("Elon Musk")).toEqual([]);
  });

  it("formats category labels", () => {
    expect(lookup.formatCategoryLabels(samplePeople[0]!)).toBe(
      "Reformer · Martyr",
    );
  });
});
