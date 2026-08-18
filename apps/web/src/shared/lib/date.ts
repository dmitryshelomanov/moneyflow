import { format } from "date-fns";
import { ru } from "date-fns/locale";

export function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function periodDefaults() {
  const to = new Date();
  const from = new Date();
  from.setDate(1);
  return { from: formatYmd(from), to: formatYmd(to) };
}

/** Inclusive local calendar days → UTC ISO bounds for API queries. */
export function toIsoRange(from: string, to: string) {
  const fromDate = parseYmd(from);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = parseYmd(to);
  toDate.setHours(23, 59, 59, 999);
  return { fromIso: fromDate.toISOString(), toIso: toDate.toISOString() };
}

export function dayKey(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return format(date, sameYear ? "d MMMM" : "d MMMM yyyy", { locale: ru });
}

/** Calendar months touched by an inclusive [from, to] range. */
export function inclusiveMonthSpan(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    1;
  return Math.max(1, months);
}

export function formatPeriodRangeLabel(from: Date, to: Date): string {
  const range = `${format(from, "d MMM yyyy", { locale: ru })} — ${format(to, "d MMM yyyy", { locale: ru })}`;
  const months = inclusiveMonthSpan(from, to);
  if (months <= 12) return range;
  return `${range} · ${months} мес`;
}

export function previousPeriodYmdRange(from: string, to: string) {
  const start = parseYmd(from);
  const end = parseYmd(to);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  const oneDayMs = 24 * 60 * 60 * 1000;
  const spanDays = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / oneDayMs) + 1,
  );

  const prevEnd = new Date(start.getTime() - oneDayMs);
  const prevStart = new Date(prevEnd.getTime() - (spanDays - 1) * oneDayMs);

  return {
    from: formatYmd(prevStart),
    to: formatYmd(prevEnd),
  };
}
