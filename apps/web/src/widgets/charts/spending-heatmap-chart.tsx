import { useMemo } from "react";
import { formatMoney } from "@moneyflow/shared";
import type { HeatmapCell } from "@/entities/stats/api/stats-api";
import { cn } from "@/shared/lib/cn";

type SpendingHeatmapChartProps = {
  cells: HeatmapCell[];
  currency: string;
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const HEAT_LEVELS = [
  "bg-[#ebedf0]",
  "bg-[#c6e48b]",
  "bg-[#7bc96f]",
  "bg-[#239a3b]",
  "bg-[#196127]",
];

function intensityClass(ratio: number) {
  if (ratio <= 0) return HEAT_LEVELS[0];
  if (ratio < 0.25) return HEAT_LEVELS[1];
  if (ratio < 0.5) return HEAT_LEVELS[2];
  if (ratio < 0.75) return HEAT_LEVELS[3];
  return HEAT_LEVELS[4];
}

export function SpendingHeatmapChart({
  cells,
  currency,
}: SpendingHeatmapChartProps) {
  const { max, hottest, bySlot } = useMemo(() => {
    const maxValue = cells.reduce((acc, cell) => Math.max(acc, cell.total), 0);
    const top = [...cells].sort((a, b) => b.total - a.total)[0] ?? null;
    const map = new Map(
      cells.map((cell) => [`${cell.weekday}-${cell.hour}`, cell]),
    );
    return { max: maxValue, hottest: top, bySlot: map };
  }, [cells]);

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-black md:text-xl">
        Тепловая карта расходов
      </h3>
      <div className="overflow-x-auto rounded-2xl border border-black/15 p-2">
        <div className="grid min-w-[680px] grid-cols-[60px_repeat(24,minmax(0,1fr))] gap-1">
          <div />
          {Array.from({ length: 24 }, (_, hour) => (
            <div
              key={`hour-${hour}`}
              className="text-center text-[10px] text-black/50"
            >
              {hour}
            </div>
          ))}
          {WEEKDAYS.map((weekday, weekdayIndex) => (
            <div key={`row-${weekdayIndex}`} className="contents">
              <div
                key={`weekday-${weekday}`}
                className="flex items-center text-xs font-medium text-black/60"
              >
                {weekday}
              </div>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell = bySlot.get(`${weekdayIndex}-${hour}`) ?? null;
                const total = cell?.total ?? 0;
                const ratio = max > 0 ? total / max : 0;
                return (
                  <div
                    key={`${weekdayIndex}-${hour}`}
                    className={cn(
                      "h-5 rounded-sm border border-black/10",
                      intensityClass(ratio),
                    )}
                    title={`${weekday} ${hour}:00 — ${formatMoney(total, currency)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-black/60">
        <span>Меньше</span>
        {HEAT_LEVELS.map((className, idx) => (
          <div
            key={idx}
            className={cn(
              "h-3.5 w-3.5 rounded-[3px] border border-black/10",
              className,
            )}
          />
        ))}
        <span>Больше</span>
        <span className="ml-1 text-black/45">
          0 → {formatMoney(max, currency)}
        </span>
      </div>
      <p className="text-sm text-black/60">
        Пик:{" "}
        {hottest
          ? `${WEEKDAYS[hottest.weekday]} ${hottest.hour}:00 (${formatMoney(hottest.total, currency)})`
          : "нет данных"}
      </p>
    </div>
  );
}
