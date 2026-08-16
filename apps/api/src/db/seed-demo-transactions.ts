import { randomBytes } from "node:crypto";
import { db, sqlite } from "./client.js";
import { accounts, categories, transactions } from "./schema.js";
import { seedBaseCategories } from "./seed-categories.js";

const ACCOUNT_MAIN = "main";
const ACCOUNT_CARD = "card";
const ACCOUNT_CASH = "cash";

function newId() {
  return randomBytes(12).toString("hex");
}

function toMinor(rubles: number) {
  return Math.round(rubles * 100);
}

const DEMO_ACCOUNTS = [
  {
    id: ACCOUNT_MAIN,
    name: "Основной",
    matchHint: "наличные,кэш,cash,основной,main",
    openingBalance: toMinor(50_000),
    isDefault: true,
  },
  {
    id: ACCOUNT_CARD,
    name: "Карта",
    matchHint: "карта,card,кредитная,дебетовая",
    openingBalance: toMinor(15_000),
    isDefault: false,
  },
  {
    id: ACCOUNT_CASH,
    name: "Наличные",
    matchHint: "наличные,кэш,cash",
    openingBalance: toMinor(5_000),
    isDefault: false,
  },
] as const;

function isoLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}:00.000Z`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Prefer card for everyday spend; cash for small cash-like expenses. */
function pickCardOrCash(cashWeight = 0.3): string {
  return Math.random() < cashWeight ? ACCOUNT_CASH : ACCOUNT_CARD;
}

type Cat = { id: string; name: string };

type Draft = {
  type: "expense" | "income";
  categoryName: string;
  amount: number;
  occurredAt: Date;
  note: string;
  accountId: string;
};

function buildDrafts(monthsBack: number): Draft[] {
  const drafts: Draft[] = [];
  const now = new Date();
  now.setHours(12, 0, 0, 0);

  for (let m = monthsBack - 1; m >= 0; m--) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const dim = daysInMonth(year, month);
    const lastDay = m === 0 ? Math.min(now.getDate(), dim) : dim;

    // Зарплата → Основной
    drafts.push({
      type: "income",
      categoryName: "Зарплата",
      amount: 100_000,
      occurredAt: new Date(year, month, Math.min(5, lastDay), 10, 15),
      note: "Зарплата",
      accountId: ACCOUNT_MAIN,
    });
    if (lastDay >= 20) {
      drafts.push({
        type: "income",
        categoryName: "Зарплата",
        amount: 45_000,
        occurredAt: new Date(year, month, 20, 10, 20),
        note: "Аванс",
        accountId: ACCOUNT_MAIN,
      });
    }

    // Иногда прочий доход → Карта
    if (Math.random() < 0.45 && lastDay >= 12) {
      drafts.push({
        type: "income",
        categoryName: "Прочий доход",
        amount: randInt(3_000, 25_000),
        occurredAt: new Date(
          year,
          month,
          randInt(8, lastDay),
          14,
          randInt(0, 50),
        ),
        note: pick(["Фриланс", "Возврат", "Кэшбек", "Подарок"]),
        accountId: ACCOUNT_CARD,
      });
    }

    // Фикс. расходы → Основной
    const fixed: Array<{
      name: string;
      amount: number;
      day: number;
      note: string;
    }> = [
      { name: "Ипотека", amount: 42_000, day: 3, note: "Ипотека" },
      {
        name: "Коммуналка",
        amount: randInt(4_500, 7_200),
        day: 8,
        note: "ЖКХ",
      },
      { name: "Связь", amount: 640, day: 2, note: "МТС" },
      { name: "Зал", amount: 3_500, day: 1, note: "Фитнес" },
    ];
    for (const f of fixed) {
      if (f.day <= lastDay) {
        drafts.push({
          type: "expense",
          categoryName: f.name,
          amount: f.amount,
          occurredAt: new Date(year, month, f.day, 11, randInt(0, 40)),
          note: f.note,
          accountId: ACCOUNT_MAIN,
        });
      }
    }

    // Продукты → Карта / иногда Наличные
    for (let i = 0; i < randInt(8, 12); i++) {
      const day = randInt(1, lastDay);
      drafts.push({
        type: "expense",
        categoryName: "Продукты",
        amount: randInt(600, 4_800),
        occurredAt: new Date(year, month, day, randInt(10, 20), randInt(0, 59)),
        note: pick(["Пятёрочка", "Лента", "ВкусВилл", "Магнит", "Перекрёсток"]),
        accountId: pickCardOrCash(0.2),
      });
    }

    // Фастфуд / развлечения / такси / транспорт
    for (let i = 0; i < randInt(4, 8); i++) {
      drafts.push({
        type: "expense",
        categoryName: "Фастфуд",
        amount: randInt(350, 1_800),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          randInt(12, 22),
          randInt(0, 59),
        ),
        note: pick(["Додо", "Вкусно и точка", "Шаурма", "Суши"]),
        accountId: pickCardOrCash(0.55),
      });
    }
    for (let i = 0; i < randInt(3, 6); i++) {
      const note = pick(["Кофе", "Кино", "Подписка", "Кафе"]);
      drafts.push({
        type: "expense",
        categoryName: "Развлечения",
        amount: randInt(250, 2_500),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          randInt(9, 21),
          randInt(0, 59),
        ),
        note,
        accountId: note === "Кофе" ? pickCardOrCash(0.6) : ACCOUNT_CARD,
      });
    }
    for (let i = 0; i < randInt(3, 7); i++) {
      drafts.push({
        type: "expense",
        categoryName: "Такси",
        amount: randInt(280, 1_200),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          randInt(8, 23),
          randInt(0, 59),
        ),
        note: "Яндекс Go",
        accountId: ACCOUNT_CARD,
      });
    }
    for (let i = 0; i < randInt(2, 5); i++) {
      const note = pick(["Метро", "Бензин", "Автобус"]);
      drafts.push({
        type: "expense",
        categoryName: "Транспорт",
        amount: randInt(50, 3_500),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          randInt(8, 20),
          randInt(0, 59),
        ),
        note,
        accountId: note === "Бензин" ? ACCOUNT_CARD : pickCardOrCash(0.7),
      });
    }

    // Маркетплейсы / одежда / красота / аптеки / здоровье / животные → Карта
    // Переводы/кредиты → Основной
    if (Math.random() < 0.8) {
      drafts.push({
        type: "expense",
        categoryName: "Маркетплейсы",
        amount: randInt(1_200, 12_000),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          16,
          randInt(0, 40),
        ),
        note: pick(["Ozon", "Wildberries"]),
        accountId: ACCOUNT_CARD,
      });
    }
    if (Math.random() < 0.45) {
      drafts.push({
        type: "expense",
        categoryName: "Одежда",
        amount: randInt(2_000, 15_000),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          15,
          randInt(0, 40),
        ),
        note: pick(["Uniqlo", "Zara", "WB одежда"]),
        accountId: ACCOUNT_CARD,
      });
    }
    if (Math.random() < 0.4) {
      drafts.push({
        type: "expense",
        categoryName: "Красота",
        amount: randInt(800, 4_500),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          13,
          randInt(0, 40),
        ),
        note: pick(["Стрижка", "Косметика"]),
        accountId: ACCOUNT_CARD,
      });
    }
    if (Math.random() < 0.55) {
      drafts.push({
        type: "expense",
        categoryName: "Аптеки",
        amount: randInt(300, 2_800),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          12,
          randInt(0, 40),
        ),
        note: "Аптека",
        accountId: pickCardOrCash(0.25),
      });
    }
    if (Math.random() < 0.25) {
      drafts.push({
        type: "expense",
        categoryName: "Здоровье",
        amount: randInt(1_500, 8_000),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          11,
          randInt(0, 40),
        ),
        note: pick(["Анализы", "Стоматолог", "Врач"]),
        accountId: ACCOUNT_CARD,
      });
    }
    if (Math.random() < 0.5) {
      drafts.push({
        type: "expense",
        categoryName: "Животные",
        amount: randInt(400, 3_200),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          17,
          randInt(0, 40),
        ),
        note: pick(["Корм", "Ветклиника"]),
        accountId: ACCOUNT_CARD,
      });
    }
    if (Math.random() < 0.35) {
      drafts.push({
        type: "expense",
        categoryName: "Переводы/кредиты",
        amount: randInt(2_000, 15_000),
        occurredAt: new Date(
          year,
          month,
          randInt(1, lastDay),
          18,
          randInt(0, 40),
        ),
        note: pick(["Рассрочка", "Перевод"]),
        accountId: ACCOUNT_MAIN,
      });
    }
  }

  return drafts.filter((d) => d.occurredAt.getTime() <= Date.now());
}

function resetDemoAccounts() {
  sqlite.exec("DELETE FROM transactions;");
  try {
    sqlite.exec("DELETE FROM advice_cache;");
  } catch {
    // table may not exist on older DBs
  }
  sqlite.exec("DELETE FROM accounts;");

  const now = new Date().toISOString();
  for (const a of DEMO_ACCOUNTS) {
    db.insert(accounts)
      .values({
        id: a.id,
        name: a.name,
        matchHint: a.matchHint,
        openingBalance: a.openingBalance,
        isDefault: a.isDefault,
        createdAt: now,
      })
      .run();
  }
}

export function seedDemoTransactions(monthsBack = 12) {
  seedBaseCategories();
  resetDemoAccounts();

  const cats = db.select().from(categories).all() as Cat[];
  const byName = new Map(cats.map((c) => [c.name, c]));

  const drafts = buildDrafts(monthsBack);
  const now = new Date().toISOString();
  let inserted = 0;
  const byAccount: Record<string, number> = {
    [ACCOUNT_MAIN]: 0,
    [ACCOUNT_CARD]: 0,
    [ACCOUNT_CASH]: 0,
  };

  for (const draft of drafts) {
    const cat = byName.get(draft.categoryName);
    if (!cat) {
      throw new Error(`Category missing: ${draft.categoryName}`);
    }
    db.insert(transactions)
      .values({
        id: newId(),
        type: draft.type,
        amount: toMinor(draft.amount),
        currency: "RUB",
        accountId: draft.accountId,
        categoryId: cat.id,
        occurredAt: isoLocal(draft.occurredAt),
        note: draft.note,
        source: "web",
        rawText: `${draft.note} ${draft.amount}`,
        createdAt: now,
      })
      .run();
    inserted += 1;
    byAccount[draft.accountId] = (byAccount[draft.accountId] ?? 0) + 1;
  }

  return { inserted, monthsBack, byAccount };
}

const isDirectRun = process.argv[1]?.includes("seed-demo-transactions");
if (isDirectRun) {
  const parsed = Number.parseInt(process.argv[2] ?? "12", 10);
  const monthsBack = Number.isFinite(parsed) && parsed > 0 ? parsed : 12;
  const result = seedDemoTransactions(monthsBack);
  console.log(
    `Seeded ${result.inserted} transactions for last ${result.monthsBack} months`,
  );
  console.log(
    `Accounts: main=${result.byAccount[ACCOUNT_MAIN]}, card=${result.byAccount[ACCOUNT_CARD]}, cash=${result.byAccount[ACCOUNT_CASH]}`,
  );
}
