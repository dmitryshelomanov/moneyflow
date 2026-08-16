import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { formatMoney } from "@moneyflow/shared";
import {
  CategoryIcon,
  resolveCategoryIconName,
} from "@/entities/category/ui/category-icon";
import { cn } from "@/shared/lib/cn";

const COLORS = [
  "#ff6ea9",
  "#6ce85e",
  "#d8aef2",
  "#77b7f5",
  "#ffe88f",
  "#5bd7d3",
  "#f188a4",
  "#d8fb88",
  "#ffbe7a",
  "#aeb8ff",
];

const RADIAN = Math.PI / 180;

function darkenHexColor(hex: string, factor = 0.58) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex;
  const r = Math.max(
    0,
    Math.min(
      255,
      Math.round(Number.parseInt(normalized.slice(0, 2), 16) * factor),
    ),
  );
  const g = Math.max(
    0,
    Math.min(
      255,
      Math.round(Number.parseInt(normalized.slice(2, 4), 16) * factor),
    ),
  );
  const b = Math.max(
    0,
    Math.min(
      255,
      Math.round(Number.parseInt(normalized.slice(4, 6), 16) * factor),
    ),
  );
  return `#${r.toString(16).padStart(2, "0")}${g
    .toString(16)
    .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

export type CategorySlice = {
  categoryId?: string | null;
  name: string;
  value: number;
  totalMinor: number;
  icon: string;
  color: string;
};

type CategoryPieChartProps = {
  items: Array<{
    categoryId?: string | null;
    name: string;
    value: number;
    totalMinor: number;
    icon?: string | null;
  }>;
  currency: string;
  emptyLabel?: string;
  onSliceClick?: (slice: CategorySlice) => void;
};

function IconLabel({
  cx = 0,
  cy = 0,
  midAngle = 0,
  innerRadius = 0,
  outerRadius = 0,
  percent = 0,
  index = 0,
  slices,
}: PieLabelRenderProps & { slices: CategorySlice[] }) {
  const slice = slices[Number(index)];
  if (!slice || percent < 0.08) return null;

  const radius =
    Number(innerRadius) + (Number(outerRadius) - Number(innerRadius)) * 0.55;
  const x = Number(cx) + radius * Math.cos(-midAngle * RADIAN);
  const y = Number(cy) + radius * Math.sin(-midAngle * RADIAN);

  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: "none" }}>
      <circle r={12} fill="white" fillOpacity={0.95} />
      <foreignObject x={-9} y={-9} width={18} height={18}>
        <div className="flex h-[18px] w-[18px] items-center justify-center">
          <CategoryIcon
            name={slice.icon}
            className="h-3 w-3"
            style={{ color: darkenHexColor(slice.color) }}
            strokeWidth={2.25}
          />
        </div>
      </foreignObject>
    </g>
  );
}

type ActiveSliceProps = {
  cx?: number;
  cy?: number;
  innerRadius?: number;
  outerRadius?: number;
  startAngle?: number;
  endAngle?: number;
  fill?: string;
};

function ActiveSlice(props: ActiveSliceProps) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } =
    props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={(outerRadius ?? 0) + 6}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke="rgba(255,255,255,0.9)"
      strokeWidth={2}
    />
  );
}

export function CategoryPieChart({
  items,
  currency,
  emptyLabel = "Нет данных за период",
  onSliceClick,
}: CategoryPieChartProps) {
  const MAX_VISIBLE = 6;
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const slices = useMemo<CategorySlice[]>(() => {
    const sorted = [...items].sort((a, b) => b.totalMinor - a.totalMinor);
    const visible = sorted.slice(0, MAX_VISIBLE);
    const tail = sorted.slice(MAX_VISIBLE);
    const tailTotal = tail.reduce((sum, row) => sum + row.totalMinor, 0);
    const prepared = tailTotal
      ? [
          ...visible,
          {
            categoryId: null,
            name: "Прочее",
            value: tailTotal / 100,
            totalMinor: tailTotal,
            icon: "Circle",
          },
        ]
      : visible;
    return prepared.map((item, i) => ({
      categoryId: item.categoryId ?? null,
      name: item.name,
      value: item.value,
      totalMinor: item.totalMinor,
      icon: resolveCategoryIconName({
        icon: item.icon,
        categoryName: item.name,
      }),
      color: COLORS[i % COLORS.length],
    }));
  }, [items]);

  const totalMinor = slices.reduce((sum, s) => sum + s.totalMinor, 0);
  const selected = activeIndex != null ? slices[activeIndex] : null;

  if (slices.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-black/55 sm:h-64 md:h-72">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="relative mx-auto h-56 w-full max-w-[360px] overflow-hidden sm:h-64 md:h-72 md:max-w-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
              stroke="rgba(0,0,0,0.7)"
              strokeWidth={2}
              label={(props) => <IconLabel {...props} slices={slices} />}
              labelLine={false}
              isAnimationActive={false}
              activeIndex={activeIndex ?? undefined}
              activeShape={ActiveSlice}
              onClick={(_slice, index) => {
                setActiveIndex((prev) => (prev === index ? null : index));
              }}
              style={{ cursor: "pointer", outline: "none" }}
            >
              {slices.map((slice) => (
                <Cell
                  key={slice.name}
                  fill={slice.color}
                  style={{ outline: "none", cursor: "pointer" }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <button
            type="button"
            className="pointer-events-auto flex max-w-[65%] flex-col items-center rounded-full border-2 border-black/90 bg-[#fffdf5] px-3 py-2 text-center shadow-[0_3px_0_rgba(0,0,0,0.8)] sm:max-w-[58%] sm:px-3.5 sm:py-2.5 md:max-w-[46%] md:px-3 md:py-2"
            onClick={() => setActiveIndex(null)}
            aria-label="Сбросить выбор"
          >
            {selected ? (
              <>
                <div className="flex items-center gap-1.5 text-xs font-medium text-black/75 md:text-[11px]">
                  <CategoryIcon
                    name={selected.icon}
                    className="h-3 w-3 shrink-0"
                    style={{ color: darkenHexColor(selected.color) }}
                    strokeWidth={2.3}
                  />
                  <span className="truncate">{selected.name}</span>
                </div>
                <div className="mt-0.5 font-display text-sm leading-tight text-black sm:text-base md:text-base">
                  {formatMoney(selected.totalMinor, currency)}
                </div>
              </>
            ) : (
              <>
                <div className="text-[11px] uppercase tracking-[0.14em] text-black/55 md:text-[10px]">
                  Итого
                </div>
                <div className="font-display text-sm leading-tight text-black sm:text-base md:text-lg">
                  {formatMoney(totalMinor, currency)}
                </div>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:gap-2">
        {slices.map((slice, index) => {
          const share =
            totalMinor > 0
              ? Math.round((slice.totalMinor / totalMinor) * 100)
              : 0;
          const active = activeIndex === index;
          return (
            <button
              key={slice.name}
              type="button"
              onClick={() =>
                setActiveIndex((prev) => {
                  const next = prev === index ? null : index;
                  if (next != null && onSliceClick) onSliceClick(slices[next]);
                  return next;
                })
              }
              className={cn(
                "inline-flex w-full min-w-0 items-center gap-1.5 rounded-full border-2 border-black/70 bg-[#fff6be] px-2.5 py-1 text-left text-xs text-black/75 shadow-[0_3px_0_rgba(0,0,0,0.75)] transition hover:bg-[#ffef93] sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm",
                active && "border-black/90 bg-[#d8fb88]",
              )}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black/10"
                style={{
                  backgroundColor: `${slice.color}2b`,
                  color: darkenHexColor(slice.color),
                }}
              >
                <CategoryIcon
                  name={slice.icon}
                  className="h-3.5 w-3.5"
                  strokeWidth={2.35}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-tight text-black">
                    {slice.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-black/55">
                    {share}%
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[11px] tabular-nums text-black sm:text-xs">
                  {formatMoney(slice.totalMinor, currency)}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
