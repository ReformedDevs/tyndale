import { syncContent } from "../src/content/sync/index.js";

const full =
  process.argv.includes("--full") || process.argv.includes("--rebuild");
const prune = process.argv.includes("--prune");

syncContent({ full, prune }).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
