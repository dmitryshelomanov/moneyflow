import { randomBytes } from "node:crypto";
import { db, sqlite } from "./client.js";
import { categories, transactions } from "./schema.js";
import { seedBaseCategories } from "./seed-categories.js";

function newId() {
  return randomBytes(12).toString("hex");
}

function toMinor(rubles: number) {
  return Math.round(rubles * 100);
}

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

type Cat = { id: string; name: string; type: "expense" | "income" };

type Draft = {
  type: "expense" | "income";
  categoryName: string;
  amount: number;
  occurredAt: Date;
  note: string;
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

    // Зарплата
    drafts.push({
      type: "income",
      categoryName: "Зарплата",
      amount: 100_000,
      occurredAt: new Date(year, month, Math.min(5, lastDay), 10, 15),
      note: "Зарплата",
    });
    if (lastDay >= 20) {
      drafts.push({
        type: "income",
        categoryName: "Зарплата",
        amount: 45_000,
        occurredAt: new Date(year, month, 20, 10, 20),
        note: "Аванс",
      });
    }

    // Иногда прочий доход
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
      });
    }

    // Фикс. расходы
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
        });
      }
    }

    // Продукты ~8–12 раз
    for (let i = 0; i < randInt(8, 12); i++) {
      const day = randInt(1, lastDay);
      drafts.push({
        type: "expense",
        categoryName: "Продукты",
        amount: randInt(600, 4_800),
        occurredAt: new Date(year, month, day, randInt(10, 20), randInt(0, 59)),
        note: pick(["Пятёрочка", "Лента", "ВкусВилл", "Магнит", "Перекрёсток"]),
      });
    }

    // Фастфуд / развлечения / такси
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
      });
    }
    for (let i = 0; i < randInt(3, 6); i++) {
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
        note: pick(["Кофе", "Кино", "Подписка", "Кафе"]),
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
      });
    }
    for (let i = 0; i < randInt(2, 5); i++) {
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
        note: pick(["Метро", "Бензин", "Автобус"]),
      });
    }

    // Маркетплейсы / одежда / красота / аптеки / здоровье / животные
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
      });
    }
  }

  return drafts.filter((d) => d.occurredAt.getTime() <= Date.now());
}

export function seedDemoTransactions(monthsBack = 6) {
  seedBaseCategories();

  const cats = db.select().from(categories).all() as Cat[];
  const byName = new Map(cats.map((c) => [c.name, c]));

  sqlite.exec("DELETE FROM transactions;");

  const drafts = buildDrafts(monthsBack);
  const now = new Date().toISOString();
  let inserted = 0;

  for (const draft of drafts) {
    const cat = byName.get(draft.categoryName);
    if (!cat || cat.type !== draft.type) {
      throw new Error(`Category missing: ${draft.categoryName}`);
    }
    db.insert(transactions)
      .values({
        id: newId(),
        type: draft.type,
        amount: toMinor(draft.amount),
        currency: "RUB",
        categoryId: cat.id,
        occurredAt: isoLocal(draft.occurredAt),
        note: draft.note,
        source: "web",
        rawText: `${draft.note} ${draft.amount}`,
        createdAt: now,
      })
      .run();
    inserted += 1;
  }

  return { inserted, monthsBack };
}

const isDirectRun = process.argv[1]?.includes("seed-demo-transactions");
if (isDirectRun) {
  const result = seedDemoTransactions(6);
  console.log(
    `Seeded ${result.inserted} transactions for last ${result.monthsBack} months`,
  );
}
