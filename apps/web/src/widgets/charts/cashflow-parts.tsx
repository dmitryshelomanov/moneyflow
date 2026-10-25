import { formatMoney } from "@moneyflow/shared";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  ChartInsightCard,
  ChartTooltipShell,
  TooltipMetricRow,
} from "@/widgets/charts/chart-utils";
import { CHART } from "@/widgets/charts/chart-theme";
import type {
  CashflowChartRow,
  CashflowDisplayMode,
} from "@/widgets/charts/cashflow-series";
import { cashflowInsightTone } from "@/widgets/charts/cashflow-series";

const EXPENSE = CHART.expense;
const INCOME = CHART.income;

export function LeftoverDot({
  cx,
  cy,
  index,
  payload,
  isLast,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: CashflowChartRow;
  isLast: boolean;
}) {
  if (cx == null || cy == null || !payload?.hasOperations) {
    return <g key={`leftover-empty-${index}`} />;
  }

  const leftover = payload.incomeMinor - payload.expenseMinor;
  if (leftover === 0) {
    return isLast ? (
      <circle
        key={`leftover-zero-${index}`}
        cx={cx}
        cy={cy}
        r={5}
        fill="#fff"
        stroke={CHART.leftover}
        strokeWidth={2.5}
      />
    ) : (
      <g key={`leftover-empty-${index}`} />
    );
  }

  const up = leftover > 0;
  const size = 6;
  const points = up
    ? `${cx},${cy - size} ${cx - size},${cy + size * 0.45} ${cx + size},${cy + size * 0.45}`
    : `${cx},${cy + size} ${cx - size},${cy - size * 0.45} ${cx + size},${cy - size * 0.45}`;

  return (
    <g key={`leftover-arrow-${index}`}>
      {isLast ? (
        <circle
          cx={cx}
          cy={cy}
          r={7}
          fill="#fff"
          stroke={CHART.leftover}
          strokeWidth={1.5}
        />
      ) : null}
      <polygon points={points} fill={up ? CHART.balance : "#ef4444"} />
    </g>
  );
}

export function CashflowTooltip({
  active,
  payload,
  currency,
  mode,
}: {
  active?: boolean;
  payload?: Array<{ payload: CashflowChartRow }>;
  currency: string;
  mode: CashflowDisplayMode;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  const leftover = row.incomeMinor - row.expenseMinor;
  return (
    <ChartTooltipShell title={row.fullLabel}>
      <TooltipMetricRow
        color={EXPENSE.active}
        label="Траты"
        value={formatMoney(row.expenseMinor, currency)}
        extra={
          mode === "percent" ? (
            <span className="text-black/65">
              ({row.expensePct.toFixed(1)}%)
            </span>
          ) : null
        }
      />
      <TooltipMetricRow
        className="mt-0.5"
        color={INCOME.active}
        label="Доходы"
        value={formatMoney(row.incomeMinor, currency)}
        extra={
          mode === "percent" ? (
            <span className="text-black/65">({row.incomePct.toFixed(1)}%)</span>
          ) : null
        }
      />
      <div className="mt-0.5 text-black/75">
        Остаток: {formatMoney(leftover, currency)}
        {mode === "percent" ? (
          <span className="text-black/65">
            {" "}
            ({row.leftoverPct.toFixed(1)}%)
          </span>
        ) : null}
      </div>
    </ChartTooltipShell>
  );
}

export function CashflowSummaryHeader({
  leftover,
  expenseMinor,
  incomeMinor,
  currency,
  selectedFullLabel,
  mode,
  smoothTrend,
  emptyMonthsHint,
  selectedIsEmptyMonth,
  plusSummary,
  granularity,
  onOpenExpense,
  onOpenIncome,
  onModeChange,
  onToggleSmooth,
}: {
  leftover: number;
  expenseMinor: number;
  incomeMinor: number;
  currency: string;
  selectedFullLabel: string | null;
  mode: CashflowDisplayMode;
  smoothTrend: boolean;
  emptyMonthsHint: string | null;
  selectedIsEmptyMonth: boolean;
  plusSummary: string | null;
  granularity: string;
  onOpenExpense: () => void;
  onOpenIncome: () => void;
  onModeChange: (mode: CashflowDisplayMode) => void;
  onToggleSmooth: () => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm text-black/60">Остаток от дохода</div>
        {selectedFullLabel ? (
          <div className="truncate text-xs capitalize text-black/45">
            {selectedFullLabel}
          </div>
        ) : (
          <div className="text-xs text-black/45">Весь период</div>
        )}
      </div>
      <div className="mt-1 font-display text-2xl tracking-tight tabular-nums text-black sm:text-3xl">
        {formatMoney(leftover, currency)}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          type="button"
          className="flex items-start gap-2 rounded-lg text-left transition-opacity hover:opacity-80"
          onClick={onOpenExpense}
        >
          <div
            className="mt-0.5 w-[3px] shrink-0 self-stretch rounded-full"
            style={{ backgroundColor: EXPENSE.active }}
          />
          <div className="min-w-0">
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: EXPENSE.active }}
            >
              Траты
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 font-display text-base tabular-nums text-black sm:text-lg">
              {formatMoney(expenseMinor, currency)}
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${EXPENSE.active}22`,
                  color: EXPENSE.active,
                }}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </button>
        <button
          type="button"
          className="flex items-start gap-2 rounded-lg text-left transition-opacity hover:opacity-80"
          onClick={onOpenIncome}
        >
          <div
            className="mt-0.5 w-[3px] shrink-0 self-stretch rounded-full"
            style={{ backgroundColor: INCOME.active }}
          />
          <div className="min-w-0">
            <div
              className="text-[10px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: INCOME.active }}
            >
              Доходы
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 font-display text-base tabular-nums text-black sm:text-lg">
              {formatMoney(incomeMinor, currency)}
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${INCOME.active}22`,
                  color: INCOME.active,
                }}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </button>
      </div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 pr-1 sm:flex-wrap sm:gap-2">
        <Button
          size="sm"
          variant={mode === "absolute" ? "secondary" : "ghost"}
          onClick={() => onModeChange("absolute")}
          className="shrink-0"
        >
          Абсолют
        </Button>
        <Button
          size="sm"
          variant={mode === "percent" ? "secondary" : "ghost"}
          onClick={() => onModeChange("percent")}
          className="shrink-0"
        >
          % от дохода
        </Button>
        <Button
          size="sm"
          variant={smoothTrend ? "secondary" : "ghost"}
          disabled={mode === "percent"}
          onClick={onToggleSmooth}
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
      {plusSummary ? (
        <p className="mt-2 text-sm font-medium text-black/75">{plusSummary}</p>
      ) : null}
    </div>
  );
}

export function CashflowInsightBanner({
  remainPct,
}: {
  remainPct: number | null;
}) {
  const tone = cashflowInsightTone(remainPct);
  return (
    <ChartInsightCard
      title={
        remainPct == null
          ? "Нет доходов за период"
          : remainPct >= 0
            ? `Осталось ${remainPct}% дохода`
            : `Минус ${Math.abs(remainPct)}% от дохода`
      }
      badge={tone.label}
      badgeClassName={tone.className}
    />
  );
}

export function cashflowXAxisTick({
  x,
  y,
  payload,
  index,
  data,
  selectedKey,
  tickStep,
  onSelect,
}: {
  x: number;
  y: number;
  payload: { value: string };
  index: number;
  data: CashflowChartRow[];
  selectedKey: string | null | undefined;
  tickStep: number;
  onSelect: (row: CashflowChartRow | undefined) => void;
}) {
  const active = data[index]?.key === selectedKey;
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
        "cursor-pointer font-mono text-[11px] tabular-nums sm:text-[12px]",
        active ? "fill-black font-semibold" : "fill-black/40",
      )}
      onClick={() => onSelect(data[index])}
    >
      {payload.value}
    </text>
  );
}
