import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(moduleDir, "..");

export function resolveContentDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.CONTENT_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(repoRoot, "content");
}

export function resolveStateDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.STATE_DIR?.trim();
  return configured
    ? path.resolve(configured)
    : path.join(os.homedir(), ".tyndale");
}

export function resolveRegistryDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.REGISTRY_DIR?.trim();
  return configured ? path.resolve(configured) : path.join(repoRoot, "registry");
}

export interface ContentPaths {
  root: string;
  syncState: string;
  bibles: string;
  poetry: string;
  confessions: string;
  devotionals: string;
  people: string;
  peopleRaw: string;
}

export function contentPaths(contentDir: string): ContentPaths {
  const peopleDir = path.join(contentDir, "people");
  return {
    root: contentDir,
    syncState: path.join(contentDir, ".sync-state.json"),
    bibles: path.join(contentDir, "bibles"),
    poetry: path.join(contentDir, "poetry"),
    confessions: path.join(contentDir, "confessions"),
    devotionals: path.join(contentDir, "devotionals"),
    people: path.join(peopleDir, "index.json"),
    peopleRaw: path.join(peopleDir, "raw"),
  };
}

export function stateFile(stateDir: string, name: string): string {
  return path.join(stateDir, name);
}
