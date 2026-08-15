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
            style={{ color: slice.color }}
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
      <div className="flex h-48 items-center justify-center text-sm text-black/55 md:h-64">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative mx-auto h-48 w-full max-w-[280px] overflow-hidden md:h-56 md:max-w-none">
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
              onClick={(slice, index) => {
                setActiveIndex((prev) => (prev === index ? null : index));
                const payload = slice as CategorySlice;
                if (payload && onSliceClick) onSliceClick(payload);
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
            className="pointer-events-auto flex max-w-[46%] flex-col items-center rounded-full border-2 border-black/90 bg-[#fffdf5] px-3 py-2 text-center shadow-[0_3px_0_rgba(0,0,0,0.8)]"
            onClick={() => setActiveIndex(null)}
            aria-label="Сбросить выбор"
          >
            {selected ? (
              <>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-black/75">
                  <CategoryIcon
                    name={selected.icon}
                    className="h-3 w-3 shrink-0"
                    style={{ color: selected.color }}
                  />
                  <span className="truncate">{selected.name}</span>
                </div>
                <div className="mt-0.5 font-display text-sm leading-tight text-black md:text-base">
                  {formatMoney(selected.totalMinor, currency)}
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-[0.14em] text-black/55">
                  Итого
                </div>
                <div className="font-display text-sm leading-tight text-black md:text-lg">
                  {formatMoney(totalMinor, currency)}
                </div>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
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
                "inline-flex min-w-[180px] max-w-full items-center gap-2 rounded-full border-2 border-black/70 bg-[#fff6be] px-3 py-1.5 text-left text-sm text-black/75 shadow-[0_3px_0_rgba(0,0,0,0.75)] transition hover:bg-[#ffef93]",
                active && "border-black/90 bg-[#d8fb88]",
              )}
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${slice.color}1f`,
                  color: slice.color,
                }}
              >
                <CategoryIcon name={slice.icon} className="h-3.5 w-3.5" />
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-black">
                  {slice.name}
                </span>
                <span className="shrink-0 text-xs text-black/55">{share}%</span>
                <span className="shrink-0 tabular-nums text-black">
                  {formatMoney(slice.totalMinor, currency)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
