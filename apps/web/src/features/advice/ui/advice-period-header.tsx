import type { ReactNode } from "react";

export function AdvicePeriodHeader({
  title,
  from,
  to,
  trailing,
}: {
  title: string;
  from: string;
  to: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="font-display text-xl text-black">{title}</h2>
        <p className="text-xs text-black/55">
          Период: {from} - {to}
        </p>
      </div>
      {trailing}
    </div>
  );
}
