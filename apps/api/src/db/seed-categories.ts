import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, sqlite } from "./client.js";
import { categories, settings } from "./schema.js";

export type SeedCategory = {
  name: string;
  type: "expense" | "income";
  icon: string;
  prompt: string;
};

export const BASE_CATEGORIES: SeedCategory[] = [
  {
    name: "Продукты",
    type: "expense",
    icon: "ShoppingBasket",
    prompt:
      "Продукты питания из магазинов/супермаркетов (Пятёрочка, Лента, ВкусВилл и т.п.). Не рестораны, не фастфуд, не кофе.",
  },
  {
    name: "Развлечения",
    type: "expense",
    icon: "Gamepad2",
    prompt:
      "Кино, концерты, игры, подписки, хобби, бары. Кофе, кафе, кофейни, напитки навынос — всегда сюда (не в Фастфуд).",
  },
  {
    name: "Ипотека",
    type: "expense",
    icon: "Home",
    prompt: "Платежи по ипотеке, жилищный кредит.",
  },
  {
    name: "Коммуналка",
    type: "expense",
    icon: "Zap",
    prompt:
      "ЖКХ, коммунальные услуги: электричество, вода, газ, отопление, квартплата, управляющая компания. Не ипотека.",
  },
  {
    name: "Переводы/кредиты",
    type: "expense",
    icon: "Landmark",
    prompt:
      "Кредиты, рассрочки, переводы в счёт долга, платежи по картам/банкам кроме ипотеки.",
  },
  {
    name: "Одежда",
    type: "expense",
    icon: "Shirt",
    prompt:
      "Одежда, обувь, аксессуары. Если покупка на маркетплейсе именно одежды — всё равно Одежда.",
  },
  {
    name: "Красота",
    type: "expense",
    icon: "Sparkles",
    prompt:
      "Салон, стрижка, косметика, уход за собой. НЕ больницы и НЕ медицинские процедуры.",
  },
  {
    name: "Транспорт",
    type: "expense",
    icon: "Car",
    prompt: "Метро, автобус, бензин, авто, каршеринг. НЕ такси.",
  },
  {
    name: "Такси",
    type: "expense",
    icon: "Navigation",
    prompt: "Такси, Яндекс Go, Uber, городские поездки на такси.",
  },
  {
    name: "Зал",
    type: "expense",
    icon: "Dumbbell",
    prompt: "Фитнес, абонемент в зал, тренировки, спортзал.",
  },
  {
    name: "Фастфуд",
    type: "expense",
    icon: "Pizza",
    prompt:
      "Бургеры, пицца, шаурма, доставка еды из фастфуда. НЕ кофе и НЕ кофейни (это Развлечения). Не продукты из магазина.",
  },
  {
    name: "Аптеки",
    type: "expense",
    icon: "Pill",
    prompt: "Аптека, лекарства, БАДы, купленные в аптеке.",
  },
  {
    name: "Здоровье",
    type: "expense",
    icon: "HeartPulse",
    prompt:
      "Больницы, клиники, анализы, процедуры, врачи. НЕ красота/салон и НЕ аптека.",
  },
  {
    name: "Связь",
    type: "expense",
    icon: "Smartphone",
    prompt: "Мобильная связь, интернет, телефония, операторы.",
  },
  {
    name: "Животные",
    type: "expense",
    icon: "Cat",
    prompt: "Корм, ветклиника, зоотовары, уход за питомцами.",
  },
  {
    name: "Маркетплейсы",
    type: "expense",
    icon: "Package",
    prompt:
      "Wildberries, Ozon, Amazon и общие покупки на маркетплейсах, если категория товара неочевидна. Одежду с маркетплейса лучше в Одежда.",
  },
  {
    name: "Зарплата",
    type: "income",
    icon: "Wallet",
    prompt: "Зарплата, аванс, оклад.",
  },
  {
    name: "Прочий доход",
    type: "income",
    icon: "PiggyBank",
    prompt: "Фриланс, возвраты, подарки деньгами, прочие поступления.",
  },
];

export const DEFAULT_CATEGORIZATION_PROMPT = `Классифицируй только по существующим категориям, если подходит.
Правила:
- Кофе / кофейня / напиток навынос → Развлечения (не Фастфуд).
- Продукты = супермаркет; Фастфуд = бургеры/пицца/доставка еды без кофе.
- Такси отдельно от Транспорт (метро/бензин/автобус).
- Красота = салон/косметика; Здоровье = врачи/больницы/процедуры; Аптеки = лекарства.
- Ипотека отдельно от Переводы/кредиты и от Коммуналка (ЖКХ/свет/вода).
- Одежда важнее Маркетплейсов, если ясно что куплена одежда.
- Не создавай новую категорию, если есть близкая существующая.`;

function newId() {
  return randomBytes(12).toString("hex");
}

/** Wipe all transactions + categories, then insert base set. */
export function resetAndSeedBaseCategories() {
  sqlite.exec("DELETE FROM transactions; DELETE FROM categories;");
  const now = new Date().toISOString();
  for (const cat of BASE_CATEGORIES) {
    db.insert(categories)
      .values({
        id: newId(),
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        prompt: cat.prompt,
        createdAt: now,
      })
      .run();
  }

  db.update(settings)
    .set({ categorizationPrompt: DEFAULT_CATEGORIZATION_PROMPT })
    .run();
}

/** Upsert base categories by name+type. Does not delete extras. */
export function seedBaseCategories() {
  const now = new Date().toISOString();
  for (const cat of BASE_CATEGORIES) {
    const existing = db
      .select()
      .from(categories)
      .where(eq(categories.name, cat.name))
      .all()
      .find((c) => c.type === cat.type);

    if (existing) {
      db.update(categories)
        .set({
          icon: cat.icon,
          prompt: cat.prompt,
        })
        .where(eq(categories.id, existing.id))
        .run();
    } else {
      db.insert(categories)
        .values({
          id: newId(),
          name: cat.name,
          type: cat.type,
          icon: cat.icon,
          prompt: cat.prompt,
          createdAt: now,
        })
        .run();
    }
  }

  db.update(settings)
    .set({ categorizationPrompt: DEFAULT_CATEGORIZATION_PROMPT })
    .run();
}
