import "server-only";

import { promises as fs } from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");

export const dataPaths = {
  bookmarks: path.join(dataDir, "bookmarks.json"),
  collections: path.join(dataDir, "collections.json"),
  tags: path.join(dataDir, "tags.json"),
};

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
}

export async function readJsonFile<T>(
  filePath: string,
  fallback: T,
): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

export async function writeJsonFile<T>(
  filePath: string,
  data: T,
): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}
