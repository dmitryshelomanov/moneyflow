import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatMoney,
  fromMinorUnits,
  type BalancePoint,
} from "@moneyflow/shared";
import {
  formatAxisMoney,
  formatChartFullLabel,
  formatChartLabel,
  parseBucketDate,
  type Granularity,
} from "@/shared/lib/chart";
import { cn } from "@/shared/lib/cn";
import {
  CHART,
  CHART_GRID,
  CHART_TOOLTIP_CLASS,
  CHART_Y_AXIS,
} from "@/widgets/charts/chart-theme";

const LINE = CHART.balance;

function xTickStep(length: number) {
  if (length <= 8) return 1;
  if (length <= 16) return 2;
  if (length <= 24) return 3;
  return 4;
}

type TotalMoneyChartProps = {
  series: BalancePoint[];
  currency: string;
  balance: number;
  averageExpensePerMonthMinor: number;
  from: string;
  to: string;
  granularity: Granularity;
};

type ChartRow = {
  key: string;
  label: string;
  fullLabel: string;
  balance: number;
  balanceMinor: number;
};

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  currency: string;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className={CHART_TOOLTIP_CLASS}>
      <div className="mb-0.5 text-xs capitalize text-black/55">
        {row.fullLabel}
      </div>
      <div className="font-display text-base text-black">
        {formatMoney(row.balanceMinor, currency)}
      </div>
    </div>
  );
}

function insightFor(
  balanceMinor: number,
  averageExpensePerMonthMinor: number,
  currency: string,
) {
  const avgExpense = averageExpensePerMonthMinor;

  if (avgExpense <= 0) {
    return {
      title: "Нет трат за период",
      detail: "Добавьте расходы, чтобы оценить запас",
      badge: "Нет данных",
      badgeClass: "border border-black/30 bg-[#fff2a3] text-black/75",
    };
  }

  if (balanceMinor <= 0) {
    return {
      title: "Запас исчерпан",
      detail: `Средний расход за месяц ${formatMoney(avgExpense, currency)}`,
      badge: "Внимание",
      badgeClass: "border border-black/30 bg-[#f188a4] text-black",
    };
  }

  const exactMonths = balanceMinor / avgExpense;
  const monthsFloor = Math.max(0, Math.floor(exactMonths));
  const monthsCeil = Math.max(1, Math.ceil(exactMonths));
  const title =
    monthsFloor === monthsCeil
      ? `Хватит примерно на ${monthsCeil} мес.`
      : `Хватит примерно на ${monthsFloor}-${monthsCeil} мес.`;
  const detail = `Средний расход за месяц ${formatMoney(avgExpense, currency)} (оценка с запасом)`;

  if (monthsCeil >= 6) {
    return {
      title,
      detail,
      badge: "Хорошо",
      badgeClass: "border border-black/30 bg-[#5bd7d3] text-black",
    };
  }
  if (monthsCeil >= 2) {
    return {
      title,
      detail,
      badge: "Нормально",
      badgeClass: "border border-black/30 bg-[#d8fb88] text-black",
    };
  }
  return {
    title: monthsCeil <= 1 ? "Запаса меньше месяца" : title,
    detail,
    badge: "Внимание",
    badgeClass: "border border-black/30 bg-[#f188a4] text-black",
  };
}

function formatMonthTick(key: string): string {
  const date = parseBucketDate(key);
  if (!date) return key;
  const label = format(date, "LLL", { locale: ru });
  return label.charAt(0).toUpperCase() + label.slice(1, 3);
}

export function TotalMoneyChart({
  series,
  currency,
  balance,
  averageExpensePerMonthMinor,
  from,
  to,
  granularity,
}: TotalMoneyChartProps) {
  const data = useMemo<ChartRow[]>(
    () =>
      series.map((p) => ({
        key: p.date,
        label: formatChartLabel(p.date, granularity),
        fullLabel: formatChartFullLabel(p.date, granularity),
        balance: fromMinorUnits(p.balance),
        balanceMinor: p.balance,
      })),
    [series, granularity],
  );

  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedKey(null);
  }, [from, to, granularity]);

  const selected = selectedKey
    ? (data.find((row) => row.key === selectedKey) ?? null)
    : null;

  const displayBalance = selected ? selected.balanceMinor : balance;
  const insight = insightFor(balance, averageExpensePerMonthMinor, currency);
  const tickStep = granularity === "month" ? 1 : xTickStep(data.length);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-display text-lg text-black sm:text-xl md:text-2xl">
            Денег всего
          </div>
          {selected ? (
            <div className="truncate text-xs capitalize text-black/45">
              {selected.fullLabel}
            </div>
          ) : null}
        </div>
        <div className="mt-1 font-display text-2xl tracking-tight tabular-nums text-black sm:text-3xl md:text-4xl">
          {formatMoney(displayBalance, currency)}
        </div>
      </div>

      <div className="h-44 sm:h-48 md:h-56">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-black/55">
            Нет данных за период
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 12, right: 8, left: 8, bottom: 0 }}
              style={{ cursor: "pointer" }}
              onClick={(state) => {
                const label = state?.activeLabel;
                if (label == null) return;
                const row = data.find((d) => d.label === label);
                if (!row) return;
                setSelectedKey((prev) => (prev === row.key ? null : row.key));
              }}
            >
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={LINE} stopOpacity={0.35} />
                  <stop offset="55%" stopColor={LINE} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={LINE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...CHART_GRID} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval={0}
                padding={{ left: 16, right: 16 }}
                tickMargin={8}
                tick={({ x, y, payload, index }) => {
                  const row = data[index];
                  const key = row?.key;
                  const active =
                    key === (selected?.key ?? data[data.length - 1]?.key);

                  const showDayMonthTick = (() => {
                    if (granularity !== "day" || !key) return false;
                    if (index === 0 || index === data.length - 1) return true;
                    const current = parseBucketDate(key);
                    const prev = parseBucketDate(data[index - 1]?.key ?? "");
                    if (!current || !prev) return false;
                    return current.getMonth() !== prev.getMonth();
                  })();

                  const hidden =
                    granularity === "month"
                      ? false
                      : granularity === "day"
                        ? !showDayMonthTick
                        : !active &&
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
                        "font-mono text-[11px] tabular-nums",
                        active ? "fill-black font-semibold" : "fill-black/40",
                      )}
                    >
                      {granularity === "day" && key
                        ? formatMonthTick(key)
                        : payload.value}
                    </text>
                  );
                }}
              />
              <YAxis
                {...CHART_Y_AXIS}
                domain={["dataMin", "dataMax"]}
                tickFormatter={(value: number) =>
                  formatAxisMoney(value, currency)
                }
              />
              <Tooltip
                cursor={{
                  stroke: LINE,
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  strokeOpacity: 0.5,
                }}
                content={<ChartTooltip currency={currency} />}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={LINE}
                strokeWidth={2.5}
                fill="url(#balanceFill)"
                activeDot={{
                  r: 6,
                  fill: "#fff",
                  stroke: LINE,
                  strokeWidth: 3,
                }}
                dot={(props) => {
                  const { cx, cy, index } = props;
                  const row = data[index ?? -1];
                  const isSelected = row?.key === selected?.key;
                  const isLast = index === data.length - 1 && !selected;
                  if (cx == null || cy == null) {
                    return <g key={`dot-empty-${index}`} />;
                  }
                  if (!isSelected && !isLast) {
                    return <g key={`dot-hidden-${row?.key ?? index}`} />;
                  }
                  return (
                    <circle
                      key={`dot-${row?.key ?? index}`}
                      cx={cx}
                      cy={cy}
                      r={6}
                      fill="#fff"
                      stroke={LINE}
                      strokeWidth={3}
                    />
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-2xl border-2 border-black/90 bg-[#fff6be] px-4 py-3 shadow-[0_4px_0_rgba(0,0,0,0.75)]">
        <div className="font-medium text-black">{insight.title}</div>
        <div className="mt-1 text-sm text-black/65">{insight.detail}</div>
        <div
          className={cn(
            "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
            insight.badgeClass,
          )}
        >
          {insight.badge}
        </div>
      </div>
    </div>
  );
}
