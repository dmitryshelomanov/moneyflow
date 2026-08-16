import fs from "node:fs";

const dbPath = process.env.DATABASE_PATH;
if (!dbPath) {
  throw new Error("DATABASE_PATH must be set by vitest.config.ts");
}

if (dbPath !== ":memory:") {
  for (const suffix of ["", "-wal", "-shm"]) {
    const filePath = `${dbPath}${suffix}`;
    if (fs.existsSync(filePath)) fs.rmSync(filePath);
  }
}
