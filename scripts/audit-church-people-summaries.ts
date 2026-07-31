import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const { readFileSync } = await import("node:fs");

import { validateSummaryQuality } from "../src/people/wikipedia.js";
import { contentPaths, resolveContentDir } from "../src/paths.js";

interface PersonEntry {
  id: string;
  name: string;
  dates?: string;
  summary: string;
}

const paths = contentPaths(resolveContentDir());
const data = JSON.parse(readFileSync(paths.people, "utf8")) as {
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
