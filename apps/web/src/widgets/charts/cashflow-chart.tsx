import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronRight } from "lucide-react";
import {
  formatMoney,
  fromMinorUnits,
  type TimeseriesPoint,
} from "@moneyflow/shared";
import {
  fillKeys,
  formatChartFullLabel,
  formatChartLabel,
  keyPrefixLength,
  type Granularity,
} from "@/shared/lib/chart";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

const EXPENSE = {
  muted: "#d8c8ff",
  active: "#9b7cf6",
};
const INCOME = {
  muted: "#9fe8d8",
  active: "#2ec4a8",
};

type CashflowChartProps = {
  series: TimeseriesPoint[];
  currency: string;
  periodIncome: number;
  periodExpense: number;
  from: string;
  to: string;
  granularity: Granularity;
  onOpenTransactions?: (payload: {
    bucketKey: string | null;
    type: "income" | "expense";
  }) => void;
};

type ChartRow = {
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

type DisplayMode = "absolute" | "percent";

function movingAverage(values: number[], window = 3): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    const sample = values.slice(from, i + 1);
    if (sample.length === 0) return 0;
    return sample.reduce((sum, value) => sum + value, 0) / sample.length;
  });
}

function xTickStep(length: number) {
  if (length <= 8) return 1;
  if (length <= 16) return 2;
  if (length <= 24) return 3;
  return 4;
}

function ChartTooltip({
  active,
  payload,
  currency,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  currency: string;
  mode: DisplayMode;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  const leftover = row.incomeMinor - row.expenseMinor;
  return (
    <div className="rounded-2xl border-2 border-black/90 bg-[#fffdf5] px-3 py-2 text-sm shadow-[0_4px_0_rgba(0,0,0,0.8)]">
      <div className="mb-1 font-medium text-black">{row.fullLabel}</div>
      <div className="flex items-center gap-2 text-[#7c5cbf]">
        <span className="h-2 w-2 rounded-full bg-[#9b7cf6]" />
        Траты: {formatMoney(row.expenseMinor, currency)}
        {mode === "percent" ? (
          <span className="text-black/65">({row.expensePct.toFixed(1)}%)</span>
        ) : null}
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-[#0f9f88]">
        <span className="h-2 w-2 rounded-full bg-[#2ec4a8]" />
        Доходы: {formatMoney(row.incomeMinor, currency)}
        {mode === "percent" ? (
          <span className="text-black/65">({row.incomePct.toFixed(1)}%)</span>
        ) : null}
      </div>
      <div className="mt-0.5 text-black/75">
        Остаток: {formatMoney(leftover, currency)}
        {mode === "percent" ? (
          <span className="text-black/65">
            {" "}
            ({row.leftoverPct.toFixed(1)}%)
          </span>
        ) : null}
      </div>
    </div>
  );
}

function insightTone(remainPct: number | null) {
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

export function CashflowChart({
  series,
  currency,
  periodIncome,
  periodExpense,
  from,
  to,
  granularity,
  onOpenTransactions,
}: CashflowChartProps) {
  const [mode, setMode] = useState<DisplayMode>("absolute");
  const [smoothTrend, setSmoothTrend] = useState(false);
  const data = useMemo(() => {
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
  }, [series, from, to, granularity]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedKey(null);
  }, [from, to, granularity]);

  const selected = selectedKey
    ? (data.find((row) => row.key === selectedKey) ?? null)
    : null;

  const incomeMinor = selected ? selected.incomeMinor : periodIncome;
  const expenseMinor = selected ? selected.expenseMinor : periodExpense;
  const leftover = incomeMinor - expenseMinor;
  const emptyMonths = data.filter((row) => !row.hasOperations);
  const selectedIsEmptyMonth = selected != null && !selected.hasOperations;
  const emptyMonthsHint =
    emptyMonths.length > 0
      ? emptyMonths.map((row) => row.label).join(", ")
      : null;
  const remainPct =
    incomeMinor > 0 ? Math.round((leftover / incomeMinor) * 100) : null;
  const tone = insightTone(remainPct);
  const tickStep = xTickStep(data.length);
  const barsAreEmpty = data.every((d) => d.expense === 0 && d.income === 0);
  const isSingleBucket = data.length === 1;
  const expenseDataKey = mode === "percent" ? "expensePct" : "expense";
  const incomeDataKey = mode === "percent" ? "incomePct" : "income";
  const lineDataKey =
    mode === "percent"
      ? "leftoverPct"
      : smoothTrend
        ? "leftoverTrend"
        : "leftover";

  const selectRow = (row: ChartRow | undefined) => {
    if (!row) return;
    setSelectedKey((prev) => (prev === row.key ? null : row.key));
  };

  const openTransactions = (type: "income" | "expense") => {
    onOpenTransactions?.({ bucketKey: selectedKey, type });
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-sm text-black/60">Остаток от дохода</div>
          {selected ? (
            <div className="truncate text-xs capitalize text-black/45">
              {selected.fullLabel}
            </div>
          ) : (
            <div className="text-xs text-black/45">Весь период</div>
          )}
        </div>
        <div className="mt-1 font-display text-2xl tracking-tight text-black sm:text-3xl">
          {formatMoney(leftover, currency)}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 sm:gap-x-6">
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg text-left transition-opacity hover:opacity-80"
            onClick={() => openTransactions("expense")}
          >
            <span className="font-medium text-[#8b6ad8]">
              {formatMoney(expenseMinor, currency)}
            </span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ebe4ff] text-[#8b6ad8]">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm text-black/60">Траты</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg text-left transition-opacity hover:opacity-80"
            onClick={() => openTransactions("income")}
          >
            <span className="font-medium text-[#1aa994]">
              {formatMoney(incomeMinor, currency)}
            </span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d8f6ef] text-[#1aa994]">
              <ChevronRight className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm text-black/60">Доходы</span>
          </button>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 pr-1 sm:flex-wrap sm:gap-2">
          <Button
            size="sm"
            variant={mode === "absolute" ? "secondary" : "ghost"}
            onClick={() => setMode("absolute")}
            className="shrink-0"
          >
            Абсолют
          </Button>
          <Button
            size="sm"
            variant={mode === "percent" ? "secondary" : "ghost"}
            onClick={() => setMode("percent")}
            className="shrink-0"
          >
            % от дохода
          </Button>
          <Button
            size="sm"
            variant={smoothTrend ? "secondary" : "ghost"}
            disabled={mode === "percent"}
            onClick={() => setSmoothTrend((prev) => !prev)}
            className="shrink-0"
          >
            Сглаживание MA(3)
          </Button>
        </div>
        {granularity === "month" ? (
          selectedIsEmptyMonth ? (
            <p className="mt-2 text-xs text-black/60">
              В этом месяце нет операций. Столбики показаны как пустые.
            </p>
          ) : emptyMonthsHint ? (
            <p className="mt-2 text-xs text-black/60">
              Месяцы без операций: {emptyMonthsHint}
            </p>
          ) : null
        ) : null}
      </div>

      <div className="h-52 sm:h-56 md:h-60">
        {barsAreEmpty ? (
          <div className="flex h-full items-center justify-center text-sm text-black/55">
            Нет данных за период
          </div>
        ) : (
          <div
            className={cn(
              "h-full",
              isSingleBucket && "mx-auto w-full max-w-[360px]",
            )}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                barGap={4}
                barCategoryGap={isSingleBucket ? "58%" : "22%"}
                margin={{ top: 6, right: 0, left: 0, bottom: 0 }}
                style={{ cursor: "pointer" }}
                onClick={(state) => {
                  const row = state?.activePayload?.[0]?.payload as
                    ChartRow | undefined;
                  selectRow(row);
                }}
              >
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={({ x, y, payload, index }) => {
                    const active = data[index]?.key === selected?.key;
                    const hidden =
                      !active &&
                      index % tickStep !== 0 &&
                      index !== data.length - 1 &&
                      index !== 0;
                    if (hidden) return <g />;
                    return (
                      <text
                        x={x}
                        y={y + 12}
                        textAnchor="middle"
                        className={cn(
                          "cursor-pointer text-[11px] sm:text-[12px]",
                          active ? "fill-black font-semibold" : "fill-black/40",
                        )}
                        onClick={() => selectRow(data[index])}
                      >
                        {payload.value}
                      </text>
                    );
                  }}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.12)", radius: 6 }}
                  content={<ChartTooltip currency={currency} mode={mode} />}
                />
                <Bar
                  dataKey={expenseDataKey}
                  name="Траты"
                  radius={[4, 4, 0, 0]}
                  minPointSize={3}
                  maxBarSize={isSingleBucket ? 72 : 42}
                  onClick={(item) =>
                    selectRow(item?.payload as ChartRow | undefined)
                  }
                >
                  {data.map((row) => {
                    const isSelected = row.key === selected?.key;
                    const dimmed = selected != null && !isSelected;
                    const isEmptyMonth = !row.hasOperations;
                    return (
                      <Cell
                        key={`e-${row.key}`}
                        fill={isSelected ? EXPENSE.active : EXPENSE.muted}
                        fillOpacity={dimmed ? 0.45 : isEmptyMonth ? 0.55 : 1}
                        cursor="pointer"
                      />
                    );
                  })}
                </Bar>
                <Bar
                  dataKey={incomeDataKey}
                  name="Доходы"
                  radius={[4, 4, 0, 0]}
                  minPointSize={3}
                  maxBarSize={isSingleBucket ? 72 : 42}
                  onClick={(item) =>
                    selectRow(item?.payload as ChartRow | undefined)
                  }
                >
                  {data.map((row) => {
                    const isSelected = row.key === selected?.key;
                    const dimmed = selected != null && !isSelected;
                    const isEmptyMonth = !row.hasOperations;
                    return (
                      <Cell
                        key={`i-${row.key}`}
                        fill={isSelected ? INCOME.active : INCOME.muted}
                        fillOpacity={dimmed ? 0.45 : isEmptyMonth ? 0.55 : 1}
                        cursor="pointer"
                      />
                    );
                  })}
                </Bar>
                <Line
                  type="monotone"
                  dataKey={lineDataKey}
                  name="Остаток"
                  stroke="#334155"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#334155" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-2xl border-2 border-black/90 bg-[#fff6be] px-4 py-3 shadow-[0_4px_0_rgba(0,0,0,0.75)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-medium text-black">
              {remainPct == null
                ? "Нет доходов за период"
                : remainPct >= 0
                  ? `Осталось ${remainPct}% дохода`
                  : `Минус ${Math.abs(remainPct)}% от дохода`}
            </div>
            <div
              className={cn(
                "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                tone.className,
              )}
            >
              {tone.label}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
