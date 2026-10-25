import { formatMoney } from "@moneyflow/shared";
import { GlassCard } from "@/shared/ui/glass-card";

type SummaryLike = {
  balance: number;
  periodIncome: number;
  periodExpense: number;
  currency: string;
} | null;

export function DashboardKpiStrip({
  summary,
  ratio,
}: {
  summary: SummaryLike;
  ratio: number | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
      <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
        <div className="flex gap-2.5 md:gap-3">
          <div className="w-[3px] shrink-0 self-stretch rounded-full bg-[#22c55e]" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#16a34a] md:text-xs">
              Баланс
            </div>
            <div className="mt-1 font-display text-lg leading-tight tabular-nums text-black md:mt-2 md:text-3xl">
              {summary ? formatMoney(summary.balance, summary.currency) : "—"}
            </div>
          </div>
        </div>
      </GlassCard>
      <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
        <div className="flex gap-2.5 md:gap-3">
          <div className="w-[3px] shrink-0 self-stretch rounded-full bg-[#4F6BED]" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#4F6BED] md:text-xs">
              Доход за период
            </div>
            <div className="mt-1 font-display text-lg leading-tight tabular-nums text-black md:mt-2 md:text-3xl">
              {summary
                ? formatMoney(summary.periodIncome, summary.currency)
                : "—"}
            </div>
          </div>
        </div>
      </GlassCard>
      <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
        <div className="flex gap-2.5 md:gap-3">
          <div className="w-[3px] shrink-0 self-stretch rounded-full bg-[#E67E22]" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#E67E22] md:text-xs">
              Расход за период
            </div>
            <div className="mt-1 font-display text-lg leading-tight tabular-nums text-black md:mt-2 md:text-3xl">
              {summary
                ? formatMoney(summary.periodExpense, summary.currency)
                : "—"}
            </div>
          </div>
        </div>
      </GlassCard>
      <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
        <div className="flex gap-2.5 md:gap-3">
          <div className="w-[3px] shrink-0 self-stretch rounded-full bg-[#6B7280]" />
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6B7280] md:text-xs">
              Доля расходов
            </div>
            <div className="mt-1 font-display text-lg leading-tight tabular-nums text-black md:mt-2 md:text-3xl">
              {ratio == null ? "—" : `${ratio}%`}
            </div>
            <div className="mt-1 text-[11px] text-black/55 md:text-xs">
              {ratio == null ? "нет дохода в периоде" : "от дохода за период"}
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
