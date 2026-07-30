import { copyFile, mkdir, access } from "node:fs/promises";
import path from "node:path";

import { repoRoot, stateFile } from "../paths.js";

const LEGACY_STATE_FILES = [
  "user-translations.json",
  "guild-translations.json",
  "user-formats.json",
  "guild-formats.json",
  "guild-analytics.json",
  "guild-devotionals.json",
] as const;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function migrateLegacyStateFiles(stateDir: string): Promise<void> {
  await mkdir(stateDir, { recursive: true });
  const legacyDir = path.join(repoRoot, "data");

  for (const fileName of LEGACY_STATE_FILES) {
    const targetPath = stateFile(stateDir, fileName);
    if (await fileExists(targetPath)) {
      continue;
    }

    const legacyPath = path.join(legacyDir, fileName);
    if (await fileExists(legacyPath)) {
      await copyFile(legacyPath, targetPath);
      console.info(`Migrated ${fileName} from data/ to ${stateDir}`);
    }
  }
}
