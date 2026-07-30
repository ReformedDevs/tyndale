import { describe, expect, it } from "vitest";

import { buildPersonEmbed } from "./format.js";
import { ChurchPeopleLookup } from "./lookup.js";
import type { ChurchPersonEntry } from "./types.js";

const person: ChurchPersonEntry = {
  id: "william-tyndale",
  name: "William Tyndale",
  aliases: ["Tyndale"],
  categories: ["reformer", "martyr"],
  wikipediaTitle: "William Tyndale",
  wikipediaUrl: "https://en.wikipedia.org/wiki/William_Tyndale",
  sourceLabel: "Wikipedia (CC BY-SA 4.0)",
  dates: "c. 1494–1536",
  summary:
    "English biblical translator who produced the first New Testament translated from Greek into English. His work deeply influenced later English Bibles, and he was martyred in 1536.",
  imageUrl:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Beza%27s_Icones%2C_contemporary_portrait_of_William_Tyndale.jpg/400px-Beza%27s_Icones%2C_contemporary_portrait_of_William_Tyndale.jpg",
};

describe("buildPersonEmbed", () => {
  it("sets title, dates, summary, thumbnail, and footer in one embed", () => {
    const lookup = ChurchPeopleLookup.fromPeople([person]);
    const embed = buildPersonEmbed(person, lookup);

    expect(embed.data.title).toBe("William Tyndale");
    expect(embed.data.url).toBe(person.wikipediaUrl);
    expect(embed.data.thumbnail?.url).toBe(person.imageUrl);
    expect(embed.data.footer?.text).toContain("Reformer");
    expect(embed.data.description).toContain("c. 1494–1536");
    expect(embed.data.description).toContain("biblical translator");
    expect(embed.data.description).toContain("Read more on Wikipedia");
    expect((embed.data.description?.length ?? 0)).toBeLessThanOrEqual(4096);
  });
});
