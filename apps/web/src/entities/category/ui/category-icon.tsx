import type { ComponentType } from "react";
import * as Icons from "lucide-react";
import type { LucideProps } from "lucide-react";

const ICON_REGISTRY = Icons as unknown as Record<
  string,
  ComponentType<LucideProps>
>;

type CategoryType = "expense" | "income";

type IconSuggestionRule = {
  pattern: RegExp;
  icon: string;
};

const ICON_SUGGESTION_RULES: IconSuggestionRule[] = [
  {
    pattern: /(авиабилет|авиаперелет|самолет|отел|тур|duty free)/i,
    icon: "Plane",
  },
  { pattern: /(ж\/д|ржд|поезд)/i, icon: "Train" },
  { pattern: /(такси|uber|яндекс go)/i, icon: "Navigation" },
  { pattern: /(транспорт|каршеринг|заправк|авто|дорог)/i, icon: "Car" },
  { pattern: /(коммунал|жкх|электр|газ|вода|квартплат)/i, icon: "Zap" },
  {
    pattern: /(кредит|ипотек|перевод|банк|финанс|кошелек|госуслуг)/i,
    icon: "Landmark",
  },
  { pattern: /(продукт|супермаркет)/i, icon: "ShoppingBasket" },
  {
    pattern: /(маркетплейс|ozon|wildberries|amazon|различные товары)/i,
    icon: "Package",
  },
  { pattern: /(фастфуд|пицц)/i, icon: "Pizza" },
  { pattern: /(ресторан|кафе|кофе|бар|доставка еды)/i, icon: "Utensils" },
  { pattern: /(космет|красот|салон)/i, icon: "Sparkles" },
  { pattern: /(медицин|здоров|клиник|врач)/i, icon: "HeartPulse" },
  { pattern: /(аптек|лекарств)/i, icon: "Pill" },
  { pattern: /(интернет|связь|телефон|мобильн)/i, icon: "Smartphone" },
  { pattern: /(книг|канцтовар|образован)/i, icon: "BookOpen" },
  { pattern: /(кино|развлеч|лотере|онлайн-кино)/i, icon: "Gamepad2" },
  { pattern: /(ремонт|мебел|услуг|сервис)/i, icon: "Wrench" },
  { pattern: /(одежд|обув)/i, icon: "Shirt" },
  { pattern: /(подарк|цвет)/i, icon: "Gift" },
  { pattern: /(животн|ветклиник|зоо)/i, icon: "Cat" },
  { pattern: /(тренировк|зал|спорт)/i, icon: "Dumbbell" },
  { pattern: /(ювелир|часы)/i, icon: "Gem" },
  {
    pattern: /(бонус|кэшбек|процент|доход|зарплат|пополнени)/i,
    icon: "Wallet",
  },
];

function hasIconName(name?: string | null): name is string {
  if (!name) return false;
  return Boolean(ICON_REGISTRY[name]);
}

export function resolveCategoryIconName({
  icon,
  categoryName,
  type,
}: {
  icon?: string | null;
  categoryName?: string | null;
  type?: CategoryType;
}) {
  const cleaned = icon?.trim();
  if (cleaned && cleaned !== "Circle" && hasIconName(cleaned)) {
    return cleaned;
  }

  const normalizedName = (categoryName ?? "").toLowerCase();
  for (const rule of ICON_SUGGESTION_RULES) {
    if (rule.pattern.test(normalizedName) && hasIconName(rule.icon)) {
      return rule.icon;
    }
  }

  if (type === "income") return "Wallet";
  return "Circle";
}

export function CategoryIcon({
  name,
  className,
  ...props
}: { name: string; className?: string } & LucideProps) {
  const Comp = ICON_REGISTRY[name] ?? Icons.Circle;
  return <Comp className={className} {...props} />;
}

export const ICON_OPTIONS = [
  "Circle",
  "Coffee",
  "Utensils",
  "ShoppingBasket",
  "Car",
  "Navigation",
  "Bus",
  "Home",
  "ShoppingBag",
  "Shirt",
  "Sparkles",
  "HeartPulse",
  "Pill",
  "Dumbbell",
  "Pizza",
  "Gamepad2",
  "Plane",
  "Wallet",
  "Briefcase",
  "Gift",
  "Smartphone",
  "Zap",
  "PiggyBank",
  "Landmark",
  "Package",
  "Cat",
] as const;
