import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateSummaryQuality } from "../src/people/wikipedia.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(rootDir, "data", "church-people.json");

interface PersonEntry {
  id: string;
  name: string;
  dates?: string;
  summary: string;
}

const data = JSON.parse(readFileSync(dataPath, "utf8")) as {
  people: PersonEntry[];
};

const issues = data.people
  .map((person) => ({
    person,
    problems: validateSummaryQuality(person.summary, person.dates),
  }))
  .filter((entry) => entry.problems.length > 0)
  .sort((left, right) => left.person.name.localeCompare(right.person.name));

console.log(`Audited ${data.people.length} entries; ${issues.length} flagged.\n`);

for (const { person, problems } of issues) {
  console.log(`${person.name} (${person.id})`);
  console.log(`  problems: ${problems.join(", ")}`);
  console.log(`  dates: ${person.dates ?? "(none)"}`);
  console.log(
    `  summary: ${person.summary.slice(0, 160)}${person.summary.length > 160 ? "…" : ""}`,
  );
  console.log();
}

if (issues.length > 0) {
  process.exitCode = 1;
}
