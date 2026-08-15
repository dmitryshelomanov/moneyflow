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

export function ParetoChart({ items, currency }: ParetoChartProps) {
  const data: Row[] = items.slice(0, 8).map((item, index) => ({
    name: item.categoryName,
    shortName: shortLabel(item.categoryName),
    total: fromMinorUnits(item.total),
    totalMinor: item.total,
    cumulative: item.cumulativePct,
    rank: index + 1,
  }));

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
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 12, left: 4, bottom: 20 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="rgba(148,163,184,0.2)"
              strokeDasharray="3 6"
            />
            <XAxis
              dataKey="shortName"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={28}
              tick={{ fontSize: 11 }}
            />
            <YAxis yAxisId="money" hide />
            <YAxis yAxisId="share" orientation="right" domain={[0, 100]} />
            <Tooltip
              formatter={(_, name, item) => {
                const payload = item?.payload as Row;
                if (name === "Накопительно, %") {
                  return `${payload.cumulative.toFixed(1)}%`;
                }
                return formatMoney(payload.totalMinor, currency);
              }}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as Row | undefined;
                return row?.name ?? "";
              }}
            />
            <Bar
              yAxisId="money"
              dataKey="total"
              name="Сумма"
              fill="#9b7cf6"
              radius={[6, 6, 0, 0]}
            />
            <Line
              yAxisId="share"
              type="monotone"
              dataKey="cumulative"
              name="Накопительно, %"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="grid gap-1 text-xs text-black/70 md:grid-cols-2">
        {data.map((row) => (
          <div key={row.rank} className="truncate">
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
