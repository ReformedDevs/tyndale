import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(repoRoot, ".env") });

const full =
  process.argv.includes("--full") || process.argv.includes("--rebuild");
const prune = process.argv.includes("--prune");

const { syncContent } = await import("../src/content/sync/index.js");

syncContent({ full, prune }).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
