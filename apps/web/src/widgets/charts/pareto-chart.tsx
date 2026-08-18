import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, fromMinorUnits } from "@moneyflow/shared";
import type { ParetoPoint } from "@/entities/stats/api/stats-api";
import { formatAxisMoney } from "@/shared/lib/chart";
import {
  CHART,
  CHART_GRID,
  CHART_TOOLTIP_CLASS,
  CHART_Y_AXIS,
} from "@/widgets/charts/chart-theme";

type ParetoChartProps = {
  items: ParetoPoint[];
  currency: string;
};

type Row = {
  name: string;
  shortName: string;
  total: number;
  totalMinor: number;
  cumulative: number;
  rank: number;
};

function shortLabel(value: string, max = 9) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload: Row }>;
  currency: string;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload;
  return (
    <div className={CHART_TOOLTIP_CLASS}>
      <div className="mb-1 font-medium text-black">{row.name}</div>
      <div
        className="flex items-center gap-2"
        style={{ color: CHART.expense.active }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: CHART.expense.active }}
        />
        Сумма: {formatMoney(row.totalMinor, currency)}
      </div>
      <div
        className="mt-0.5 flex items-center gap-2"
        style={{ color: CHART.balance }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: CHART.balance }}
        />
        Накопительно: {row.cumulative.toFixed(1)}%
      </div>
    </div>
  );
}

function ParetoPlot({
  data,
  currency,
  showShareAxis,
}: {
  data: Row[];
  currency: string;
  showShareAxis: boolean;
}) {
  const gradientId = showShareAxis
    ? "paretoBarFillDesktop"
    : "paretoBarFillMobile";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{
          top: 8,
          right: showShareAxis ? 12 : 8,
          left: 8,
          bottom: 20,
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={CHART.expense.active}
              stopOpacity={1}
            />
            <stop
              offset="100%"
              stopColor={CHART.expense.active}
              stopOpacity={0.58}
            />
          </linearGradient>
        </defs>
        <CartesianGrid {...CHART_GRID} />
        <XAxis
          dataKey="shortName"
          axisLine={false}
          tickLine={false}
          interval={showShareAxis ? "preserveStartEnd" : 0}
          minTickGap={showShareAxis ? 28 : 12}
          tick={{ ...CHART.tick, fontSize: showShareAxis ? 11 : 10 }}
        />
        <YAxis
          yAxisId="money"
          {...CHART_Y_AXIS}
          tickFormatter={(value: number) => formatAxisMoney(value, currency)}
        />
        <YAxis
          yAxisId="share"
          orientation="right"
          domain={[0, 100]}
          hide={!showShareAxis}
          axisLine={false}
          tickLine={false}
          width={36}
          tick={CHART.tick}
          tickFormatter={(value: number) => `${value}%`}
        />
        <Tooltip content={<ChartTooltip currency={currency} />} />
        <Bar
          yAxisId="money"
          dataKey="total"
          name="Сумма"
          fill={`url(#${gradientId})`}
          radius={[6, 6, 0, 0]}
        />
        <Line
          yAxisId="share"
          type="monotone"
          dataKey="cumulative"
          name="Накопительно, %"
          stroke={CHART.balance}
          strokeWidth={2.5}
          activeDot={{
            r: 5,
            fill: "#fff",
            stroke: CHART.balance,
            strokeWidth: 2.5,
          }}
          dot={(props) => {
            const { cx, cy, index } = props;
            if (cx == null || cy == null || index !== data.length - 1) {
              return <g key={`pareto-empty-${index}`} />;
            }
            return (
              <circle
                key="pareto-end"
                cx={cx}
                cy={cy}
                r={5}
                fill="#fff"
                stroke={CHART.balance}
                strokeWidth={2.5}
              />
            );
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ParetoChart({ items, currency }: ParetoChartProps) {
  const data: Row[] = items.slice(0, 8).map((item, index) => ({
    name: item.categoryName,
    shortName: shortLabel(item.categoryName),
    total: fromMinorUnits(item.total),
    totalMinor: item.total,
    cumulative: item.cumulativePct,
    rank: index + 1,
  }));
  const mobileData = data.slice(0, 5);

  if (data.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="font-display text-lg text-black md:text-xl">
          Pareto категорий
        </h3>
        <div className="text-sm text-black/55">Нет данных за период</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-black md:text-xl">
        Pareto категорий
      </h3>
      <div className="flex items-center gap-3 text-xs text-black/60">
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: CHART.expense.active }}
          />
          <span>Сумма</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: CHART.balance }}
          />
          <span>Накопительно, %</span>
        </div>
      </div>
      <div className="h-60 md:hidden">
        <ParetoPlot
          data={mobileData}
          currency={currency}
          showShareAxis={false}
        />
      </div>
      <div className="hidden h-64 md:block">
        <ParetoPlot data={data} currency={currency} showShareAxis />
      </div>
      <div className="grid gap-1 text-[11px] leading-snug text-black/70 md:hidden">
        {mobileData.map((row) => (
          <div key={row.rank} className="truncate tabular-nums">
            {row.rank}. {row.name} - {formatMoney(row.totalMinor, currency)}
          </div>
        ))}
      </div>
      <div className="hidden gap-1 text-xs text-black/70 md:grid md:grid-cols-2">
        {data.map((row) => (
          <div key={row.rank} className="truncate tabular-nums">
            {row.rank}. {row.name} - {formatMoney(row.totalMinor, currency)}
          </div>
        ))}
      </div>
      <p className="text-sm text-black/60">
        Помогает быстро увидеть категории, которые дают основную долю расходов.
      </p>
    </div>
  );
}
