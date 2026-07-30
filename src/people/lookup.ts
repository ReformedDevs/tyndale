import { readFile } from "node:fs/promises";
import path from "node:path";

import type { ChurchPeopleIndex, ChurchPersonEntry, PersonCategory } from "./types.js";

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function categoryLabel(categories: PersonCategory[]): string {
  const labels = categories.map((category) => {
    switch (category) {
      case "reformer":
        return "Reformer";
      case "puritan":
        return "Puritan";
      case "martyr":
        return "Martyr";
    }
  });

  return [...new Set(labels)].join(" · ");
}

export class ChurchPeopleLookup {
  private constructor(private readonly people: ChurchPersonEntry[]) {}

  static async load(dataDir: string): Promise<ChurchPeopleLookup> {
    const filePath = path.join(dataDir, "church-people.json");
    const raw = await readFile(filePath, "utf8");
    const index = JSON.parse(raw) as ChurchPeopleIndex;
    return new ChurchPeopleLookup(index.people);
  }

  static fromPeople(people: ChurchPersonEntry[]): ChurchPeopleLookup {
    return new ChurchPeopleLookup(people);
  }

  get count(): number {
    return this.people.length;
  }

  getById(id: string): ChurchPersonEntry | undefined {
    return this.people.find((person) => person.id === id);
  }

  search(query: string, limit = 5): ChurchPersonEntry[] {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return [];
    }

    const scored = this.people
      .map((person) => ({
        person,
        score: scorePersonMatch(person, normalizedQuery),
      }))
      .filter((result) => result.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return left.person.name.localeCompare(right.person.name);
      });

    return scored.slice(0, limit).map((result) => result.person);
  }

  autocomplete(query: string, limit = 25): ChurchPersonEntry[] {
    return this.search(query, limit);
  }

  formatCategoryLabels(person: ChurchPersonEntry): string {
    return categoryLabel(person.categories);
  }
}

function scorePersonMatch(
  person: ChurchPersonEntry,
  normalizedQuery: string,
): number {
  const candidates = [person.name, ...person.aliases].map(normalizeSearchText);
  let best = 0;

  for (const candidate of candidates) {
    if (candidate === normalizedQuery) {
      best = Math.max(best, 100);
      continue;
    }

    if (candidate.startsWith(normalizedQuery)) {
      best = Math.max(best, 80);
      continue;
    }

    if (normalizedQuery.startsWith(candidate) && candidate.length >= 4) {
      best = Math.max(best, 70);
      continue;
    }

    if (candidate.includes(normalizedQuery)) {
      best = Math.max(best, 60);
      continue;
    }

    const queryTokens = normalizedQuery.split(" ");
    const candidateTokens = candidate.split(" ");
    const sharedTokens = queryTokens.filter((token) =>
      candidateTokens.includes(token),
    );

    if (sharedTokens.length > 0) {
      best = Math.max(best, 20 + sharedTokens.length * 10);
    }
  }

  return best;
}
