import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeseriesPoint } from "@moneyflow/shared";
import type { Granularity } from "@/shared/lib/chart";
import { cn } from "@/shared/lib/cn";
import {
  CashflowInsightBanner,
  CashflowSummaryHeader,
  CashflowTooltip,
  LeftoverDot,
  cashflowXAxisTick,
} from "@/widgets/charts/cashflow-parts";
import {
  buildCashflowRows,
  periodUnitLabel,
  type CashflowChartRow,
  type CashflowDisplayMode,
} from "@/widgets/charts/cashflow-series";
import { chartTickStep } from "@/widgets/charts/chart-utils";
import { CHART, CHART_GRID } from "@/widgets/charts/chart-theme";

const EXPENSE = CHART.expense;
const INCOME = CHART.income;

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
  const [mode, setMode] = useState<CashflowDisplayMode>("absolute");
  const [smoothTrend, setSmoothTrend] = useState(false);
  const data = useMemo(
    () => buildCashflowRows(series, from, to, granularity),
    [series, from, to, granularity],
  );

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
  const activeBuckets = data.filter((row) => row.hasOperations);
  const plusBuckets = activeBuckets.filter(
    (row) => row.incomeMinor > row.expenseMinor,
  );
  const plusSummary =
    activeBuckets.length > 0
      ? `В плюсе ${plusBuckets.length} из ${activeBuckets.length} ${periodUnitLabel(granularity, activeBuckets.length)}`
      : null;
  const tickStep = chartTickStep(data.length);
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

  const selectRow = (row: CashflowChartRow | undefined) => {
    if (!row) return;
    setSelectedKey((prev) => (prev === row.key ? null : row.key));
  };

  const openTransactions = (type: "income" | "expense") => {
    onOpenTransactions?.({ bucketKey: selectedKey, type });
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <CashflowSummaryHeader
        leftover={leftover}
        expenseMinor={expenseMinor}
        incomeMinor={incomeMinor}
        currency={currency}
        selectedFullLabel={selected?.fullLabel ?? null}
        mode={mode}
        smoothTrend={smoothTrend}
        emptyMonthsHint={emptyMonthsHint}
        selectedIsEmptyMonth={selectedIsEmptyMonth}
        plusSummary={plusSummary}
        granularity={granularity}
        onOpenExpense={() => openTransactions("expense")}
        onOpenIncome={() => openTransactions("income")}
        onModeChange={setMode}
        onToggleSmooth={() => setSmoothTrend((prev) => !prev)}
      />

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
                margin={{ top: 14, right: 8, left: 0, bottom: 0 }}
                style={{ cursor: "pointer" }}
                onClick={(state) => {
                  const row = state?.activePayload?.[0]?.payload as
                    | CashflowChartRow
                    | undefined;
                  selectRow(row);
                }}
              >
                <defs>
                  <linearGradient
                    id="expenseBarActive"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={EXPENSE.active}
                      stopOpacity={1}
                    />
                    <stop
                      offset="100%"
                      stopColor={EXPENSE.active}
                      stopOpacity={0.62}
                    />
                  </linearGradient>
                  <linearGradient
                    id="expenseBarMuted"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={EXPENSE.muted}
                      stopOpacity={1}
                    />
                    <stop
                      offset="100%"
                      stopColor={EXPENSE.muted}
                      stopOpacity={0.55}
                    />
                  </linearGradient>
                  <linearGradient
                    id="incomeBarActive"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={INCOME.active}
                      stopOpacity={1}
                    />
                    <stop
                      offset="100%"
                      stopColor={INCOME.active}
                      stopOpacity={0.62}
                    />
                  </linearGradient>
                  <linearGradient
                    id="incomeBarMuted"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={INCOME.muted}
                      stopOpacity={1}
                    />
                    <stop
                      offset="100%"
                      stopColor={INCOME.muted}
                      stopOpacity={0.55}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={(props) =>
                    cashflowXAxisTick({
                      x: props.x,
                      y: props.y,
                      payload: props.payload,
                      index: props.index,
                      data,
                      selectedKey: selected?.key,
                      tickStep,
                      onSelect: selectRow,
                    })
                  }
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "rgba(148,163,184,0.12)", radius: 6 }}
                  content={<CashflowTooltip currency={currency} mode={mode} />}
                />
                <Bar
                  dataKey={expenseDataKey}
                  name="Траты"
                  radius={[4, 4, 0, 0]}
                  minPointSize={3}
                  maxBarSize={isSingleBucket ? 72 : 42}
                  onClick={(item) =>
                    selectRow(item?.payload as CashflowChartRow | undefined)
                  }
                >
                  {data.map((row) => {
                    const isSelected = row.key === selected?.key;
                    const dimmed = selected != null && !isSelected;
                    const isEmptyMonth = !row.hasOperations;
                    return (
                      <Cell
                        key={`e-${row.key}`}
                        fill={
                          isSelected
                            ? "url(#expenseBarActive)"
                            : "url(#expenseBarMuted)"
                        }
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
                    selectRow(item?.payload as CashflowChartRow | undefined)
                  }
                >
                  {data.map((row) => {
                    const isSelected = row.key === selected?.key;
                    const dimmed = selected != null && !isSelected;
                    const isEmptyMonth = !row.hasOperations;
                    return (
                      <Cell
                        key={`i-${row.key}`}
                        fill={
                          isSelected
                            ? "url(#incomeBarActive)"
                            : "url(#incomeBarMuted)"
                        }
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
                  stroke={CHART.leftover}
                  strokeWidth={2.5}
                  activeDot={{
                    r: 5,
                    fill: "#fff",
                    stroke: CHART.leftover,
                    strokeWidth: 2.5,
                  }}
                  dot={(props) => {
                    const { cx, cy, index, payload } = props;
                    return (
                      <LeftoverDot
                        cx={cx}
                        cy={cy}
                        index={index}
                        payload={payload as CashflowChartRow | undefined}
                        isLast={index === data.length - 1}
                      />
                    );
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <CashflowInsightBanner remainPct={remainPct} />
    </div>
  );
}
