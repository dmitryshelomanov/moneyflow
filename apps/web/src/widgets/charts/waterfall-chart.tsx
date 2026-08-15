import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, fromMinorUnits } from "@moneyflow/shared";

type WaterfallChartProps = {
  currency: string;
  balance: number;
  periodIncome: number;
  periodExpense: number;
};

type Row = {
  label: string;
  value: number;
  valueMinor: number;
};

export function WaterfallChart({
  currency,
  balance,
  periodIncome,
  periodExpense,
}: WaterfallChartProps) {
  const startBalance = balance - periodIncome + periodExpense;
  const rows: Row[] = [
    {
      label: "Старт",
      value: fromMinorUnits(startBalance),
      valueMinor: startBalance,
    },
    {
      label: "Доходы",
      value: fromMinorUnits(periodIncome),
      valueMinor: periodIncome,
    },
    {
      label: "Расходы",
      value: fromMinorUnits(-periodExpense),
      valueMinor: -periodExpense,
    },
    {
      label: "Финиш",
      value: fromMinorUnits(balance),
      valueMinor: balance,
    },
  ];

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-black md:text-xl">
        Куда ушли деньги
      </h3>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="rgba(148,163,184,0.2)"
              strokeDasharray="3 6"
            />
            <XAxis dataKey="label" axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              formatter={(_, __, item) => {
                const payload = item?.payload as Row;
                return formatMoney(payload.valueMinor, currency);
              }}
            />
            <Bar
              dataKey="value"
              radius={[8, 8, 0, 0]}
              maxBarSize={64}
              fill="#5bd7d3"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-sm text-black/60">
        Стартовый баланс + доходы - расходы = текущий итог.
      </p>
    </div>
  );
}
