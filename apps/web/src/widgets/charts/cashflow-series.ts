import { fromMinorUnits, type TimeseriesPoint } from "@moneyflow/shared";
import {
  fillKeys,
  formatChartFullLabel,
  formatChartLabel,
  keyPrefixLength,
  type Granularity,
} from "@/shared/lib/chart";

export type CashflowDisplayMode = "absolute" | "percent";

export type CashflowChartRow = {
  key: string;
  label: string;
  fullLabel: string;
  expense: number;
  income: number;
  expensePct: number;
  incomePct: number;
  expenseMinor: number;
  incomeMinor: number;
  leftover: number;
  leftoverPct: number;
  leftoverTrend: number;
  hasOperations: boolean;
};

function movingAverage(values: number[], window = 3): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    const sample = values.slice(from, i + 1);
    if (sample.length === 0) return 0;
    return sample.reduce((sum, value) => sum + value, 0) / sample.length;
  });
}

function pluralRu(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function periodUnitLabel(granularity: Granularity, count: number) {
  if (granularity === "day") return pluralRu(count, "дня", "дня", "дней");
  if (granularity === "week")
    return pluralRu(count, "недели", "недели", "недель");
  if (granularity === "year") return pluralRu(count, "года", "года", "лет");
  return pluralRu(count, "месяца", "месяца", "месяцев");
}

export function cashflowInsightTone(remainPct: number | null) {
  if (remainPct == null)
    return {
      label: "Нет данных",
      className: "border border-black/30 bg-[#fff2a3] text-black/75",
    };
  if (remainPct >= 20)
    return {
      label: "Хорошо",
      className: "border border-black/30 bg-[#5bd7d3] text-black",
    };
  if (remainPct >= 0)
    return {
      label: "Нормально",
      className: "border border-black/30 bg-[#d8fb88] text-black",
    };
  return {
    label: "Минус",
    className: "border border-black/30 bg-[#f188a4] text-black",
  };
}

export function buildCashflowRows(
  series: TimeseriesPoint[],
  from: string,
  to: string,
  granularity: Granularity,
): CashflowChartRow[] {
  const prefix = keyPrefixLength(granularity);
  const map = new Map(series.map((p) => [p.date.slice(0, prefix), p]));
  const keys = fillKeys(from, to, granularity);
  const limited =
    keys.length > 14 && granularity === "day" ? keys.slice(-14) : keys;
  const baseRows = limited.map((key) => {
    const point = map.get(key);
    const expenseMinor = point?.expense ?? 0;
    const incomeMinor = point?.income ?? 0;
    const leftoverMinor = incomeMinor - expenseMinor;
    const incomePct = incomeMinor > 0 ? 100 : 0;
    const expensePct =
      incomeMinor > 0 ? (expenseMinor / incomeMinor) * 100 : 0;
    const leftoverPct =
      incomeMinor > 0 ? (leftoverMinor / incomeMinor) * 100 : 0;
    return {
      key,
      label: formatChartLabel(key, granularity),
      fullLabel: formatChartFullLabel(key, granularity),
      expense: fromMinorUnits(expenseMinor),
      income: fromMinorUnits(incomeMinor),
      expensePct,
      incomePct,
      expenseMinor,
      incomeMinor,
      leftover: fromMinorUnits(leftoverMinor),
      leftoverPct,
      hasOperations: expenseMinor > 0 || incomeMinor > 0,
    };
  });
  const trend = movingAverage(baseRows.map((row) => row.leftover));

  return baseRows.map((row, index) => ({
    ...row,
    leftoverTrend: trend[index] ?? row.leftover,
  }));
}
