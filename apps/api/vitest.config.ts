import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      NODE_ENV: "test",
      ACCESS_KEY: "example-access-key-1234567890",
      SESSION_SECRET: "example-session-secret-1234567890",
      ALLOWED_TELEGRAM_IDS: "1",
      DATABASE_PATH: ":memory:",
      WEB_ORIGIN: "http://localhost:5173",
    },
    setupFiles: ["./src/test/setup.ts"],
    environment: "node",
    include: ["src/**/*.test.ts"],
    pool: "forks",
    fileParallelism: false,
    maxWorkers: 1,
    server: {
      deps: {
        external: ["better-sqlite3"],
      },
    },
  },
});
