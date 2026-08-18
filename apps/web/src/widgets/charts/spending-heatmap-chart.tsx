import { useMemo } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { formatMoney } from "@moneyflow/shared";
import type { HeatmapCell } from "@/entities/stats/api/stats-api";
import { parseYmd } from "@/shared/lib/date";
import { cn } from "@/shared/lib/cn";
import { CHART } from "@/widgets/charts/chart-theme";

type SpendingHeatmapChartProps = {
  cells: HeatmapCell[];
  currency: string;
  from: string;
  to: string;
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const HEAT_LEVELS = CHART.heat;

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
  from,
  to,
}: SpendingHeatmapChartProps) {
  const periodLabel = `${format(parseYmd(from), "d MMM yyyy", { locale: ru })} - ${format(
    parseYmd(to),
    "d MMM yyyy",
    { locale: ru },
  )}`;
  const { max, hottest, bySlot, byWeekday, byHour, topHours } = useMemo(() => {
    const maxValue = cells.reduce((acc, cell) => Math.max(acc, cell.total), 0);
    const top = [...cells].sort((a, b) => b.total - a.total)[0] ?? null;
    const map = new Map(
      cells.map((cell) => [`${cell.weekday}-${cell.hour}`, cell]),
    );
    const weekdayTotals = Array.from({ length: 7 }, (_, weekday) => ({
      weekday,
      total: cells
        .filter((cell) => cell.weekday === weekday)
        .reduce((sum, cell) => sum + cell.total, 0),
    }));
    const hourTotals = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      total: cells
        .filter((cell) => cell.hour === hour)
        .reduce((sum, cell) => sum + cell.total, 0),
    }));
    const topSlots = [...hourTotals]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    return {
      max: maxValue,
      hottest: top,
      bySlot: map,
      byWeekday: weekdayTotals,
      byHour: hourTotals,
      topHours: topSlots,
    };
  }, [cells]);
  const maxWeekday = byWeekday.reduce(
    (acc, row) => (row.total > acc ? row.total : acc),
    0,
  );
  const maxHour = byHour.reduce(
    (acc, row) => (row.total > acc ? row.total : acc),
    0,
  );

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg text-black md:text-xl">
        Тепловая карта расходов
      </h3>
      <p className="text-xs text-black/55">
        Период: {periodLabel}. Значения агрегированы по дням недели и часам.
      </p>
      <div className="space-y-3 rounded-2xl border border-black/15 p-3 md:hidden">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-black/50">
            По дням недели
          </div>
          {byWeekday.map((row) => (
            <div
              key={row.weekday}
              className="grid grid-cols-[26px_1fr_auto] items-center gap-2"
            >
              <span className="text-xs text-black/60">
                {WEEKDAYS[row.weekday]}
              </span>
              <div className="h-2 rounded-full bg-black/10">
                <div
                  className="h-2 rounded-full bg-[#e67e22]"
                  style={{
                    width:
                      maxWeekday > 0
                        ? `${Math.max(8, Math.round((row.total / maxWeekday) * 100))}%`
                        : "8%",
                  }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-black/65">
                {formatMoney(row.total, currency)}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-black/50">
            Активные часы
          </div>
          {topHours.map((row) => (
            <div
              key={row.hour}
              className="grid grid-cols-[42px_1fr_auto] items-center gap-2"
            >
              <span className="text-xs text-black/60">{row.hour}:00</span>
              <div className="h-2 rounded-full bg-black/10">
                <div
                  className="h-2 rounded-full bg-[#c45a10]"
                  style={{
                    width:
                      maxHour > 0
                        ? `${Math.max(8, Math.round((row.total / maxHour) * 100))}%`
                        : "8%",
                  }}
                />
              </div>
              <span className="text-[11px] tabular-nums text-black/65">
                {formatMoney(row.total, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-black/15 p-2 md:block">
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
                      "h-5 rounded-md border border-black/10",
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
      <div className="hidden flex-wrap items-center gap-2 text-xs text-black/60 md:flex">
        <span>Меньше</span>
        {HEAT_LEVELS.map((className, idx) => (
          <div
            key={idx}
            className={cn(
              "h-3.5 w-3.5 rounded-md border border-black/10",
              className,
            )}
          />
        ))}
        <span>Больше</span>
        <span className="ml-1 text-black/45">
          0 → {formatMoney(max, currency)}
        </span>
      </div>
      <div className="space-y-1 text-xs text-black/60 md:hidden">
        <div className="font-medium text-black/70">Шкала интенсивности</div>
        <div className="flex items-center gap-2">
          <span>Меньше</span>
          {HEAT_LEVELS.map((className, idx) => (
            <div
              key={idx}
              className={cn(
                "h-3.5 w-3.5 rounded-md border border-black/10",
                className,
              )}
            />
          ))}
          <span>Больше</span>
        </div>
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
