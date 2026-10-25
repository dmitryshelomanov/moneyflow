import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { CHART_TOOLTIP_CLASS } from "@/widgets/charts/chart-theme";

export function chartTickStep(length: number) {
  if (length <= 8) return 1;
  if (length <= 16) return 2;
  if (length <= 24) return 3;
  return 4;
}

export function TooltipMetricRow({
  color,
  label,
  value,
  extra,
  className,
}: {
  color?: string;
  label: string;
  value: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      style={color ? { color } : undefined}
    >
      {color ? (
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      ) : null}
      <span>
        {label}: {value}
      </span>
      {extra}
    </div>
  );
}

export function ChartTooltipShell({
  title,
  children,
  titleClassName,
}: {
  title: ReactNode;
  children: ReactNode;
  titleClassName?: string;
}) {
  return (
    <div className={CHART_TOOLTIP_CLASS}>
      <div className={cn("mb-1 font-medium text-black", titleClassName)}>
        {title}
      </div>
      {children}
    </div>
  );
}

export function ChartInsightCard({
  title,
  detail,
  badge,
  badgeClassName,
}: {
  title: ReactNode;
  detail?: ReactNode;
  badge?: ReactNode;
  badgeClassName?: string;
}) {
  return (
    <div className="rounded-2xl border-2 border-black/90 bg-[#fff6be] px-4 py-3 shadow-[0_4px_0_rgba(0,0,0,0.75)]">
      <div className="font-medium text-black">{title}</div>
      {detail ? (
        <div className="mt-1 text-sm text-black/65">{detail}</div>
      ) : null}
      {badge != null ? (
        <div
          className={cn(
            "mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
            badgeClassName,
          )}
        >
          {badge}
        </div>
      ) : null}
    </div>
  );
}
