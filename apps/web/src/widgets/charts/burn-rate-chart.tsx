import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, type TimeseriesPoint } from "@moneyflow/shared";
import { cn } from "@/shared/lib/cn";
import {
  fillKeys,
  formatChartFullLabel,
  formatChartLabel,
} from "@/shared/lib/chart";

type BurnRateChartProps = {
  from: string;
  to: string;
  currency: string;
  daySeries: TimeseriesPoint[];
};

type Row = {
  date: string;
  label: string;
  fullLabel: string;
  actual: number;
  planned: number;
  actualMinor: number;
  plannedMinor: number;
};

function xTickStep(length: number) {
  if (length <= 8) return 1;
  if (length <= 16) return 2;
  if (length <= 24) return 3;
  if (length <= 31) return 4;
  return 6;
}

export function BurnRateChart({
  from,
  to,
  currency,
  daySeries,
}: BurnRateChartProps) {
  const data = useMemo<Row[]>(() => {
    const byDate = new Map(
      daySeries.map((item) => [item.date.slice(0, 10), item]),
    );
    const keys = fillKeys(from, to, "day");
    const totalExpense = keys.reduce(
      (sum, key) => sum + (byDate.get(key)?.expense ?? 0),
      0,
    );
    let cumulativeExpense = 0;
    return keys.map((key, index) => {
      cumulativeExpense += byDate.get(key)?.expense ?? 0;
      const planned = Math.round((totalExpense * (index + 1)) / keys.length);
      return {
        date: key,
        label: formatChartLabel(key, "day"),
        fullLabel: formatChartFullLabel(key, "day"),
        actual: cumulativeExpense / 100,
        planned: planned / 100,
        actualMinor: cumulativeExpense,
        plannedMinor: planned,
      };
    });
  }, [daySeries, from, to]);
  const tickStep = xTickStep(data.length);
  const last = data[data.length - 1];
  const deltaMinor = (last?.actualMinor ?? 0) - (last?.plannedMinor ?? 0);
  const deltaPct =
    last && last.plannedMinor > 0
      ? Math.round((deltaMinor / last.plannedMinor) * 1000) / 10
      : 0;
  const isOverPlan = deltaMinor > 0;

  if (data.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="font-display text-lg text-black md:text-xl">
          Burn-rate
        </h3>
        <div className="text-sm text-black/55">Нет данных за период</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-black md:text-xl">
        Burn-rate расходов
      </h3>
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={cn(
            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
            isOverPlan
              ? "border-black/20 bg-[#ffd3dc] text-black"
              : "border-black/20 bg-[#d8fb88] text-black",
          )}
        >
          {isOverPlan ? "Выше плана" : "Ниже плана"}:{" "}
          {deltaMinor > 0 ? "+" : ""}
          {formatMoney(deltaMinor, currency)} ({deltaMinor > 0 ? "+" : ""}
          {deltaPct}%)
        </div>
        <div className="inline-flex items-center gap-3 text-xs text-black/60">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded bg-[#94a3b8]" />
            План
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-5 rounded bg-[#f188a4]" />
            Факт
          </span>
        </div>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="rgba(148,163,184,0.2)"
              strokeDasharray="3 6"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={({ x, y, payload, index }) => {
                const hidden =
                  index % tickStep !== 0 &&
                  index !== data.length - 1 &&
                  index !== 0;
                if (hidden) return <g />;
                return (
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor="middle"
                    className="fill-black/45 text-[11px]"
                  >
                    {payload.value}
                  </text>
                );
              }}
            />
            <YAxis hide />
            <Tooltip
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as Row | undefined;
                return row?.fullLabel ?? "";
              }}
              formatter={(_, name, item) => {
                const payload = item?.payload as Row;
                if (name === "План")
                  return formatMoney(payload.plannedMinor, currency);
                return formatMoney(payload.actualMinor, currency);
              }}
            />
            <Line
              type="monotone"
              dataKey="planned"
              name="План"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="actual"
              name="Факт"
              stroke="#f188a4"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-black/60">
        Сравнение фактического накопления расходов с равномерным темпом.
      </p>
    </div>
  );
}
