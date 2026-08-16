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
const CHART_TOP = 6;
const LIST_PREVIEW = 6;
const OTHER_SLICE_NAME = "Прочее";

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
  isOther?: boolean;
};

type CategoryInput = {
  categoryId?: string | null;
  name: string;
  value: number;
  totalMinor: number;
  icon?: string | null;
};

type CategoryPieChartProps = {
  items: CategoryInput[];
  currency: string;
  monthSpan: number;
  emptyLabel?: string;
  onSliceClick?: (slice: CategorySlice) => void;
};

type Selection = {
  pieIndex: number | null;
  listIndex: number | null;
};

const EMPTY_SELECTION: Selection = { pieIndex: null, listIndex: null };

function toSlice(item: CategoryInput, color: string): CategorySlice {
  return {
    categoryId: item.categoryId ?? null,
    name: item.name,
    value: item.value,
    totalMinor: item.totalMinor,
    icon: resolveCategoryIconName({
      icon: item.icon,
      categoryName: item.name,
    }),
    color,
  };
}

function colorForRank(index: number) {
  return COLORS[Math.min(index, CHART_TOP) % COLORS.length];
}

function pieIndexForListItem(listIndex: number, otherPieIndex: number | null) {
  if (listIndex < CHART_TOP) return listIndex;
  return otherPieIndex;
}

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

function CategoryListRow({
  slice,
  share,
  active,
  currency,
  monthSpan,
  onClick,
}: {
  slice: CategorySlice;
  share: number;
  active: boolean;
  currency: string;
  monthSpan: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full min-w-0 items-start gap-3 rounded-2xl border-2 border-black/70 bg-[#fff6be] px-3 py-2.5 text-left shadow-[0_3px_0_rgba(0,0,0,0.75)] transition hover:bg-[#ffef93]",
        active && "border-black/90 bg-[#d8fb88]",
      )}
    >
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10"
        style={{
          backgroundColor: `${slice.color}2b`,
          color: darkenHexColor(slice.color),
        }}
      >
        <CategoryIcon
          name={slice.icon}
          className="h-4 w-4"
          strokeWidth={2.35}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <span className="break-words text-sm font-medium leading-snug text-black">
            {slice.name}
          </span>
          <span className="shrink-0 pt-0.5 text-xs tabular-nums text-black/55">
            {share}%
          </span>
        </div>
        <div className="mt-1 text-sm font-semibold tabular-nums text-black">
          {formatMoney(slice.totalMinor, currency)}
        </div>
        {monthSpan > 2 ? (
          <div className="mt-0.5 text-xs tabular-nums text-black/55">
            ≈ {formatMoney(Math.round(slice.totalMinor / monthSpan), currency)}
            /мес
          </div>
        ) : null}
      </div>
    </button>
  );
}

export function CategoryPieChart({
  items,
  currency,
  monthSpan,
  emptyLabel = "Нет данных за период",
  onSliceClick,
}: CategoryPieChartProps) {
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const [listExpanded, setListExpanded] = useState(false);

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.totalMinor - a.totalMinor),
    [items],
  );

  const listItems = useMemo(
    () => sorted.map((item, index) => toSlice(item, colorForRank(index))),
    [sorted],
  );

  const slices = useMemo<CategorySlice[]>(() => {
    const top = listItems.slice(0, CHART_TOP);
    const tail = listItems.slice(CHART_TOP);
    const tailTotal = tail.reduce((sum, row) => sum + row.totalMinor, 0);
    if (!tailTotal) return top;
    return [
      ...top,
      {
        ...toSlice(
          {
            categoryId: null,
            name: OTHER_SLICE_NAME,
            value: tailTotal / 100,
            totalMinor: tailTotal,
            icon: "Circle",
          },
          colorForRank(CHART_TOP),
        ),
        isOther: true,
      },
    ];
  }, [listItems]);

  const totalMinor = slices.reduce((sum, slice) => sum + slice.totalMinor, 0);
  const selected =
    selection.pieIndex != null ? slices[selection.pieIndex] : null;
  const otherPieIndex = slices.findIndex((slice) => slice.isOther);
  const hiddenCount = Math.max(0, listItems.length - LIST_PREVIEW);
  const visibleList = listExpanded
    ? listItems
    : listItems.slice(0, LIST_PREVIEW);

  const selectPieSlice = (index: number) => {
    setSelection((prev) => {
      if (prev.pieIndex === index) return EMPTY_SELECTION;
      return {
        pieIndex: index,
        listIndex: index < CHART_TOP ? index : null,
      };
    });
  };

  const selectListItem = (listIndex: number) => {
    const slice = visibleList[listIndex];
    setSelection((prev) => {
      if (prev.listIndex === listIndex) return EMPTY_SELECTION;
      return {
        pieIndex: pieIndexForListItem(
          listIndex,
          otherPieIndex >= 0 ? otherPieIndex : null,
        ),
        listIndex,
      };
    });
    if (slice?.categoryId) onSliceClick?.(slice);
  };

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
              activeIndex={selection.pieIndex ?? undefined}
              activeShape={ActiveSlice}
              onClick={(_slice, index) => selectPieSlice(index)}
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
            onClick={() => setSelection(EMPTY_SELECTION)}
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

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {visibleList.map((slice, listIndex) => {
          const share =
            totalMinor > 0
              ? Math.round((slice.totalMinor / totalMinor) * 100)
              : 0;
          return (
            <CategoryListRow
              key={`${slice.categoryId ?? slice.name}-${listIndex}`}
              slice={slice}
              share={share}
              active={selection.listIndex === listIndex}
              currency={currency}
              monthSpan={monthSpan}
              onClick={() => selectListItem(listIndex)}
            />
          );
        })}

        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setListExpanded((prev) => !prev)}
            className="w-full rounded-2xl border-2 border-dashed border-black/40 bg-transparent px-3 py-2.5 text-sm font-medium text-black/70 transition hover:border-black/60 hover:bg-[#fff6be]/50 hover:text-black md:col-span-2"
          >
            {listExpanded ? "Скрыть" : `Показать еще · ${hiddenCount}`}
          </button>
        ) : null}
      </div>
    </div>
  );
}
