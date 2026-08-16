import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { NotATransactionError } from "./bot-messages.js";
import { migrate } from "./db/migrate.js";
import { sqlite } from "./db/client.js";
import { seedBaseCategories } from "./db/seed-categories.js";
import { env } from "./env.js";
import { createApp } from "./server/createApp.js";
import { applyParseBatch } from "./services/apply-parse.js";
import * as aiService from "./services/ai.js";
import { listTransactionsPage } from "./services/money.js";
import { resetRateLimitStore } from "./server/middleware/rate-limit.js";

const app = createApp();
const basePath = `/k/${env.ACCESS_KEY}/api`;

function cookieFromLoginResponse(response: Response) {
  const raw = response.headers.get("set-cookie");
  if (!raw) return null;
  return raw.split(";")[0] ?? null;
}

async function apiRequest(
  path: string,
  init: RequestInit = {},
  cookie?: string,
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (typeof init.body === "string" && !headers.has("content-length")) {
    headers.set(
      "content-length",
      String(new TextEncoder().encode(init.body).length),
    );
  }
  return app.request(`${basePath}${path}`, { ...init, headers });
}

async function devLogin() {
  const response = await apiRequest("/auth/dev-login", {
    method: "POST",
    body: JSON.stringify({ id: 1, name: "Test User" }),
  });
  expect(response.status).toBe(200);
  const cookie = cookieFromLoginResponse(response);
  expect(cookie).toBeTruthy();
  return cookie!;
}

describe("API regression coverage", () => {
  afterAll(() => {
    sqlite.close();
  });

  beforeAll(() => {
    migrate();
  });

  beforeEach(() => {
    sqlite.exec("DELETE FROM transactions;");
    resetRateLimitStore();
    vi.restoreAllMocks();
  });

  it("migrate restores missing allowed_telegram_ids on legacy settings table", () => {
    sqlite.exec("DROP TABLE IF EXISTS settings;");
    sqlite.exec(`
CREATE TABLE settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT NOT NULL DEFAULT 'RUB',
  opening_balance INTEGER NOT NULL DEFAULT 0,
  categorization_prompt TEXT NOT NULL DEFAULT '',
  ai_model TEXT NOT NULL DEFAULT 'openai/gpt-4o'
);
`);

    migrate();

    const cols = sqlite.prepare("PRAGMA table_info(settings)").all() as Array<{
      name: string;
    }>;
    expect(cols.some((col) => col.name === "allowed_telegram_ids")).toBe(true);
  });

  it("seedBaseCategories does not overwrite existing category prompts", () => {
    const row = sqlite.prepare("SELECT id FROM categories LIMIT 1").get() as
      { id: string } | undefined;
    expect(row).toBeTruthy();
    sqlite
      .prepare("UPDATE categories SET prompt = 'custom-prompt' WHERE id = ?")
      .run(row!.id);

    seedBaseCategories();

    const after = sqlite
      .prepare("SELECT prompt FROM categories WHERE id = ?")
      .get(row!.id) as { prompt: string };
    expect(after.prompt).toBe("custom-prompt");
  });

  it("auth dev-login creates valid session", async () => {
    const cookie = await devLogin();
    const me = await apiRequest("/auth/me", { method: "GET" }, cookie);
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user: { id: number; name: string } };
    expect(body.user.id).toBe(1);
    expect(body.user.name).toBe("Test User");
  });

  it("settings updates allowedTelegramIds", async () => {
    const cookie = await devLogin();
    const response = await apiRequest(
      "/settings",
      {
        method: "PATCH",
        body: JSON.stringify({ allowedTelegramIds: "1,2,3" }),
      },
      cookie,
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as { allowedTelegramIds: string };
    expect(body.allowedTelegramIds).toBe("1,2,3");
  });

  it("settings updates allowed fields without ACL field", async () => {
    const cookie = await devLogin();
    const response = await apiRequest(
      "/settings",
      {
        method: "PATCH",
        body: JSON.stringify({
          currency: "USD",
          openingBalance: 123.45,
          categorizationPrompt: "Updated prompt from test",
        }),
      },
      cookie,
    );
    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      currency: string;
      openingBalance: number;
      categorizationPrompt: string;
    };
    expect(body.currency).toBe("USD");
    expect(body.openingBalance).toBe(12345);
    expect(body.categorizationPrompt).toBe("Updated prompt from test");
  });

  it("transactions pagination returns cursor and hasMore", async () => {
    const cookie = await devLogin();

    await apiRequest(
      "/transactions",
      {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 100,
          note: "coffee",
          source: "web",
        }),
      },
      cookie,
    );
    await apiRequest(
      "/transactions",
      {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 200,
          note: "taxi",
          source: "web",
        }),
      },
      cookie,
    );

    const pageResponse = await apiRequest("/transactions?limit=1", {}, cookie);
    expect(pageResponse.status).toBe(200);
    const page = (await pageResponse.json()) as {
      items: unknown[];
      hasMore: boolean;
      nextCursor: string | null;
    };
    expect(page.items.length).toBe(1);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeTruthy();
  });

  it("allows any existing category for transaction type", async () => {
    const cookie = await devLogin();
    const categoryResponse = await apiRequest(
      "/categories",
      {
        method: "POST",
        body: JSON.stringify({
          name: "Salary bucket",
          icon: "Wallet",
        }),
      },
      cookie,
    );
    expect(categoryResponse.status).toBe(201);
    const category = (await categoryResponse.json()) as { id: string };

    const response = await apiRequest(
      "/transactions",
      {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 100,
          categoryId: category.id,
          note: "Invalid category relation",
          source: "web",
        }),
      },
      cookie,
    );

    expect(response.status).toBe(201);
  });

  it("patch category updates only selected transaction", async () => {
    const cookie = await devLogin();

    const fromCategoryResponse = await apiRequest(
      "/categories",
      {
        method: "POST",
        body: JSON.stringify({ name: "From", icon: "Circle" }),
      },
      cookie,
    );
    expect(fromCategoryResponse.status).toBe(201);
    const fromCategory = (await fromCategoryResponse.json()) as {
      id: string;
    };

    const toCategoryResponse = await apiRequest(
      "/categories",
      {
        method: "POST",
        body: JSON.stringify({ name: "To", icon: "Tag" }),
      },
      cookie,
    );
    expect(toCategoryResponse.status).toBe(201);
    const toCategory = (await toCategoryResponse.json()) as {
      id: string;
    };

    const firstResponse = await apiRequest(
      "/transactions",
      {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 100,
          categoryId: fromCategory.id,
          note: "same-note",
          source: "telegram",
          rawText: "same-raw",
          occurredAt: "2026-08-01T09:00:00.000Z",
        }),
      },
      cookie,
    );
    expect(firstResponse.status).toBe(201);
    const first = (await firstResponse.json()) as { id: string };

    const secondResponse = await apiRequest(
      "/transactions",
      {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 100,
          categoryId: fromCategory.id,
          note: "same-note",
          source: "telegram",
          rawText: "same-raw",
          occurredAt: "2026-08-02T10:00:00.000Z",
        }),
      },
      cookie,
    );
    expect(secondResponse.status).toBe(201);

    await apiRequest(
      "/transactions",
      {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 100,
          categoryId: fromCategory.id,
          note: "same-note",
          source: "telegram",
          rawText: "same-raw",
          occurredAt: "2026-08-03T10:00:00.000Z",
        }),
      },
      cookie,
    );

    const updateResponse = await apiRequest(
      `/transactions/${first.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          categoryId: toCategory.id,
        }),
      },
      cookie,
    );
    expect(updateResponse.status).toBe(200);
    const updateBody = (await updateResponse.json()) as {
      categoryId: string | null;
    };
    expect(updateBody.categoryId).toBe(toCategory.id);

    const pageResponse = await apiRequest("/transactions?limit=20", {}, cookie);
    expect(pageResponse.status).toBe(200);
    const page = (await pageResponse.json()) as {
      items: Array<{
        note: string | null;
        rawText: string | null;
        amount: number;
        categoryId: string | null;
      }>;
    };
    const updatedInBatch = page.items.filter(
      (tx) =>
        tx.note === "same-note" &&
        tx.rawText === "same-raw" &&
        tx.amount === 10000,
    );
    expect(updatedInBatch.length).toBeGreaterThanOrEqual(2);
    const recategorizedCount = updatedInBatch.filter(
      (tx) => tx.categoryId === toCategory.id,
    ).length;
    expect(recategorizedCount).toBe(1);
  });

  it("transactions search trims query and matches case-insensitively", async () => {
    const cookie = await devLogin();

    await apiRequest(
      "/transactions",
      {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 100,
          note: "Оплата Ёжик Такси",
          source: "web",
        }),
      },
      cookie,
    );
    await apiRequest(
      "/transactions",
      {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 80,
          note: "Продукты",
          source: "web",
        }),
      },
      cookie,
    );

    const pageResponse = await apiRequest(
      "/transactions?q=%20%D1%91%D0%96%D0%B8%D0%9A%20&limit=50",
      {},
      cookie,
    );
    expect(pageResponse.status).toBe(200);
    const page = (await pageResponse.json()) as {
      items: Array<{ note: string | null }>;
      hasMore: boolean;
      nextCursor: string | null;
    };

    expect(page.items.length).toBe(1);
    expect(page.items[0]?.note).toBe("Оплата Ёжик Такси");
  });

  it("csv-ai import saves parsed rows and creates categories", async () => {
    const cookie = await devLogin();
    vi.spyOn(aiService, "parseCsvRowsWithAi").mockResolvedValue({
      kind: "list",
      transactions: [
        {
          type: "expense",
          amount: 120,
          currency: "RUB",
          occurredAt: "2026-08-10T09:10:00.000Z",
          note: "Coffee",
          categoryName: "Кафе",
          createCategory: { name: "Кафе", icon: "Coffee" },
          confidence: 0.92,
        },
        {
          type: "expense",
          amount: 490,
          currency: "RUB",
          occurredAt: "2026-08-10T12:00:00.000Z",
          note: "Taxi",
          categoryName: "Такси",
          createCategory: { name: "Такси", icon: "Car" },
          confidence: 0.88,
        },
      ],
    });

    const response = await apiRequest(
      "/import/csv-ai",
      {
        method: "POST",
        body: JSON.stringify({
          filename: "sample.csv",
          csv: "date,amount,note\n2026-08-10,120,Coffee\n2026-08-10,490,Taxi",
        }),
      },
      cookie,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      totalRows: number;
      parsed: number;
      saved: number;
      skipped: number;
      errors: string[];
    };
    expect(body.totalRows).toBe(2);
    expect(body.parsed).toBe(2);
    expect(body.saved).toBe(2);
    expect(body.skipped).toBe(0);
    expect(body.errors).toEqual([]);

    const txPage = listTransactionsPage({ limit: 10 });
    expect(txPage.items.length).toBe(2);
  });

  it("csv-ai import continues after chunk error", async () => {
    const cookie = await devLogin();
    vi.spyOn(aiService, "parseCsvRowsWithAi")
      .mockResolvedValueOnce({
        kind: "single",
        transactions: [
          {
            type: "income",
            amount: 5000,
            currency: "RUB",
            occurredAt: "2026-08-01T10:00:00.000Z",
            note: "Salary part",
            categoryName: "Доход",
            createCategory: { name: "Доход", icon: "Wallet" },
            confidence: 0.9,
          },
        ],
      })
      .mockRejectedValueOnce(new Error("AI overload"));

    const rows = Array.from(
      { length: 21 },
      (_, index) =>
        `2026-08-${String(index + 1).padStart(2, "0")},${index + 1},row`,
    );
    const csv = ["date,amount,note", ...rows].join("\n");
    const response = await apiRequest(
      "/import/csv-ai",
      {
        method: "POST",
        body: JSON.stringify({ csv }),
      },
      cookie,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      totalRows: number;
      parsed: number;
      saved: number;
      skipped: number;
      errors: string[];
    };
    expect(body.totalRows).toBe(21);
    expect(body.parsed).toBe(1);
    expect(body.saved).toBe(1);
    expect(body.skipped).toBe(20);
    expect(body.errors.length).toBe(1);
    expect(body.errors[0]).toContain("Chunk 2 failed");
    expect(listTransactionsPage({ limit: 10 }).items.length).toBe(1);
  });

  it("csv-ai import returns non-fatal error for empty payload", async () => {
    const cookie = await devLogin();
    const aiSpy = vi.spyOn(aiService, "parseCsvRowsWithAi");
    const response = await apiRequest(
      "/import/csv-ai",
      {
        method: "POST",
        body: JSON.stringify({ csv: "   " }),
      },
      cookie,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      totalRows: number;
      parsed: number;
      saved: number;
      skipped: number;
      errors: string[];
    };
    expect(body.totalRows).toBe(0);
    expect(body.saved).toBe(0);
    expect(body.errors).toContain("CSV is empty");
    expect(aiSpy).not.toHaveBeenCalled();
  });

  it("health endpoint checks database availability", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { ok: boolean; db: string };
    expect(body.ok).toBe(true);
    expect(body.db).toBe("ok");
  });

  it("parse returns 400 for not-a-transaction input", async () => {
    const cookie = await devLogin();
    vi.spyOn(aiService, "parseSmart").mockRejectedValueOnce(
      new NotATransactionError("Not a transaction"),
    );
    const response = await apiRequest(
      "/parse",
      {
        method: "POST",
        body: JSON.stringify({ text: "hello world" }),
      },
      cookie,
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("Not a transaction");
  });

  it("advice rejects invalid date input", async () => {
    const cookie = await devLogin();
    const response = await apiRequest(
      "/advice/pulse",
      {
        method: "POST",
        body: JSON.stringify({ from: "bad-date", to: "2026-01-01" }),
      },
      cookie,
    );
    expect(response.status).toBe(400);
  });

  it("auth route enforces rate limit", async () => {
    const headers = { "x-forwarded-for": "198.51.100.77" };
    let limited: Response | null = null;
    for (let i = 0; i < 12; i += 1) {
      const response = await apiRequest("/auth/dev-login", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: 1, name: "Rate Limit" }),
      });
      if (response.status === 429) {
        limited = response;
        break;
      }
    }
    expect(limited?.status).toBe(429);
  });

  it("applyParseBatch rolls back whole batch on failure", () => {
    expect(listTransactionsPage({ limit: 100 }).items.length).toBe(0);
    expect(() =>
      applyParseBatch(
        {
          kind: "list",
          transactions: [
            {
              type: "expense",
              amount: 100,
              currency: "RUB",
              occurredAt: new Date().toISOString(),
              note: "valid tx",
              categoryName: null,
              createCategory: null,
              confidence: 0.9,
            },
            {
              type: "expense",
              amount: -20,
              currency: "RUB",
              occurredAt: new Date().toISOString(),
              note: "invalid tx",
              categoryName: null,
              createCategory: null,
              confidence: 0.7,
            },
          ],
        },
        { source: "web", rawText: "batch" },
      ),
    ).toThrow();
    expect(listTransactionsPage({ limit: 100 }).items.length).toBe(0);
  });
});
