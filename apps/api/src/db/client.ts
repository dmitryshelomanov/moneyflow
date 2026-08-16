import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "../env.js";
import * as schema from "./schema.js";

const isMemory = env.DATABASE_PATH === ":memory:";
const dbPath = isMemory ? ":memory:" : path.resolve(env.DATABASE_PATH);
if (!isMemory) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const sqlite = new Database(dbPath);
if (!isMemory) {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 5000");
}
sqlite.pragma("foreign_keys = ON");
sqlite.function("unicode_lower", (value: unknown) => {
  if (typeof value !== "string") return null;
  return value.toLocaleLowerCase("ru");
});

export const db = drizzle(sqlite, { schema });
export { sqlite };
