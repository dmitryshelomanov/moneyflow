import * as React from "react";
import {
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ru as dateFnsRu } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { ru } from "react-day-picker/locale";
import { formatPeriodRangeLabel, formatYmd, parseYmd } from "@/shared/lib/date";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

function formatRangeLabel(from?: Date, to?: Date) {
  if (from && to) return formatPeriodRangeLabel(from, to);
  if (from) return format(from, "d MMM yyyy", { locale: dateFnsRu });
  return "Выберите период";
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const PRESETS = [
  {
    id: "month1",
    label: "1 мес",
    range: (_allTimeFrom: Date) => ({
      from: startOfMonth(startOfToday()),
      to: startOfToday(),
    }),
  },
  {
    id: "months3",
    label: "3 мес",
    range: (_allTimeFrom: Date) => ({
      from: startOfMonth(subMonths(startOfToday(), 2)),
      to: startOfToday(),
    }),
  },
  {
    id: "months6",
    label: "пол года",
    range: (_allTimeFrom: Date) => ({
      from: startOfMonth(subMonths(startOfToday(), 5)),
      to: startOfToday(),
    }),
  },
  {
    id: "months12",
    label: "год",
    range: (_allTimeFrom: Date) => ({
      from: startOfMonth(subMonths(startOfToday(), 11)),
      to: startOfToday(),
    }),
  },
  {
    id: "months24",
    label: "2 года",
    range: (_allTimeFrom: Date) => ({
      from: startOfMonth(subMonths(startOfToday(), 23)),
      to: startOfToday(),
    }),
  },
  {
    id: "months36",
    label: "3 года",
    range: (_allTimeFrom: Date) => ({
      from: startOfMonth(subMonths(startOfToday(), 35)),
      to: startOfToday(),
    }),
  },
  {
    id: "all",
    label: "Всё время",
    range: (allTimeFrom: Date) => ({ from: allTimeFrom, to: startOfToday() }),
  },
] as const;

type DateRangePickerProps = {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  className?: string;
  allTimeFrom?: string | null;
};

export function DateRangePicker({
  from,
  to,
  onChange,
  className,
  allTimeFrom,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [months, setMonths] = React.useState(1);
  const selected: DateRange = {
    from: from ? parseYmd(from) : undefined,
    to: to ? parseYmd(to) : undefined,
  };
  const [month, setMonth] = React.useState<Date>(
    selected.from ?? startOfToday(),
  );

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setMonths(mq.matches ? 2 : 1);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const allTimeStart = React.useMemo(() => {
    if (!allTimeFrom) return new Date(2000, 0, 1);
    return parseYmd(allTimeFrom);
  }, [allTimeFrom]);

  const presets = React.useMemo(
    () =>
      PRESETS.map((preset) => ({
        ...preset,
        range: () => preset.range(allTimeStart),
      })),
    [allTimeStart],
  );

  const applyRange = (range: { from: Date; to: Date }, close = true) => {
    const today = startOfToday();
    const normalizedFrom = new Date(range.from);
    normalizedFrom.setHours(0, 0, 0, 0);
    if (isAfter(normalizedFrom, today)) {
      normalizedFrom.setTime(today.getTime());
    }

    const normalizedTo = new Date(range.to);
    normalizedTo.setHours(0, 0, 0, 0);
    if (isBefore(normalizedTo, normalizedFrom)) {
      normalizedTo.setTime(normalizedFrom.getTime());
    }
    if (isAfter(normalizedTo, today)) {
      normalizedTo.setTime(today.getTime());
    }

    onChange({ from: formatYmd(normalizedFrom), to: formatYmd(normalizedTo) });
    setMonth(normalizedFrom);
    if (close) setOpen(false);
  };

  const activePresetId = presets.find((preset) => {
    if (!selected.from || !selected.to) return false;
    const range = preset.range();
    return (
      isSameDay(selected.from, range.from) && isSameDay(selected.to, range.to)
    );
  })?.id;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          className={cn(
            "w-fit max-w-full justify-start text-left font-normal",
            className,
          )}
        >
          <CalendarIcon className="size-4 text-black/65" />
          <span className="truncate">
            {formatRangeLabel(selected.from, selected.to)}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[calc(100vw-1.5rem)] overflow-hidden p-0">
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="range"
            locale={ru}
            numberOfMonths={months}
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={(range) => {
              if (!range?.from) return;
              if (!range.to) {
                applyRange({ from: range.from, to: range.from }, false);
                return;
              }
              applyRange({ from: range.from, to: range.to });
            }}
          />
          <div className="grid grid-cols-3 gap-1.5 border-t border-black/10 p-3 sm:flex sm:w-40 sm:shrink-0 sm:flex-col sm:gap-1.5 sm:border-t-0 sm:border-l">
            {presets.map((preset) => {
              const active = activePresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyRange(preset.range())}
                  className={cn(
                    "rounded-full px-2.5 py-1.5 text-center text-xs font-medium transition sm:text-left",
                    active
                      ? "border-2 border-black/90 bg-[#d8fb88] text-black shadow-[0_3px_0_rgba(0,0,0,0.8)]"
                      : "border-2 border-black/60 bg-[#fff6be] text-black/70 hover:bg-[#ffef93]",
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
