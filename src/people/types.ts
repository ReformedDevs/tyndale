export type PersonCategory = "reformer" | "puritan" | "martyr";

export interface ChurchPersonEntry {
  id: string;
  name: string;
  aliases: string[];
  categories: PersonCategory[];
  wikipediaTitle: string;
  wikipediaUrl: string;
  sourceLabel: string;
  dates?: string;
  summary: string;
  imageUrl?: string;
}

export interface ChurchPeopleIndex {
  people: ChurchPersonEntry[];
}
