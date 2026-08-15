import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { parseYmd } from "@/shared/lib/date";

export type Granularity = "day" | "week" | "month" | "year";

export function isRangeOverYear(from: string, to: string): boolean {
  const start = parseYmd(from);
  const end = parseYmd(to);
  const threshold = new Date(start);
  threshold.setFullYear(start.getFullYear() + 1);
  return end > threshold;
}

export function pickGranularity(from: string, to: string): Granularity {
  return isRangeOverYear(from, to) ? "year" : "month";
}

export function keyPrefixLength(granularity: Granularity): number {
  if (granularity === "year") return 4;
  if (granularity === "month") return 7;
  return 10;
}

export function parseBucketDate(key: string): Date | null {
  if (/^\d{4}$/.test(key)) return new Date(Number(key), 0, 1);
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return parseISO(`${key}T12:00:00`);
  const parsed = parseISO(key);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function inferGranularity(
  key: string,
  fallback: Granularity,
): Granularity {
  if (/^\d{4}$/.test(key)) return "year";
  if (/^\d{4}-\d{2}$/.test(key)) return "month";
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return fallback === "week" ? "week" : "day";
  }
  return fallback;
}

export function formatChartLabel(
  key: string,
  granularity: Granularity,
): string {
  const date = parseBucketDate(key);
  if (!date) return key;
  const g = inferGranularity(key, granularity);
  if (g === "year") return format(date, "yyyy");
  if (g === "month") {
    const label = format(date, "LLL", { locale: ru });
    return label.charAt(0).toUpperCase() + label.slice(1, 3);
  }
  if (g === "week") return format(date, "d MMM", { locale: ru });
  return format(date, "d", { locale: ru });
}

export function formatChartFullLabel(
  key: string,
  granularity: Granularity,
): string {
  const date = parseBucketDate(key);
  if (!date) return key;
  const g = inferGranularity(key, granularity);
  if (g === "year") return format(date, "yyyy");
  if (g === "month") return format(date, "LLLL yyyy", { locale: ru });
  if (g === "week") {
    const end = new Date(date);
    end.setDate(end.getDate() + 6);
    return `${format(date, "d MMM", { locale: ru })} — ${format(end, "d MMM", { locale: ru })}`;
  }
  return format(date, "d MMMM yyyy", { locale: ru });
}

export function fillKeys(
  from: string,
  to: string,
  granularity: Granularity,
): string[] {
  const start = parseYmd(from);
  const end = parseYmd(to);
  start.setHours(12, 0, 0, 0);
  end.setHours(12, 0, 0, 0);
  const keys: string[] = [];

  if (granularity === "year") {
    const cur = new Date(start.getFullYear(), 0, 1);
    const last = new Date(end.getFullYear(), 0, 1);
    while (cur <= last) {
      keys.push(String(cur.getFullYear()));
      cur.setFullYear(cur.getFullYear() + 1);
    }
    return keys;
  }

  if (granularity === "month") {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= last) {
      keys.push(
        `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`,
      );
      cur.setMonth(cur.getMonth() + 1);
    }
    return keys;
  }

  if (granularity === "week") {
    const cur = new Date(start);
    const day = cur.getDay() || 7;
    cur.setDate(cur.getDate() - day + 1);
    while (cur <= end) {
      keys.push(format(cur, "yyyy-MM-dd"));
      cur.setDate(cur.getDate() + 7);
    }
    return keys;
  }

  const cur = new Date(start);
  while (cur <= end) {
    keys.push(format(cur, "yyyy-MM-dd"));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}
