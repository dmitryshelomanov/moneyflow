import { formatMoney } from "@moneyflow/shared";
import type {
  FinancePulseCategory,
  FinancePulseResponse,
  FinancePulseVerdict,
} from "@moneyflow/shared";
import { GlassCard } from "@/shared/ui/glass-card";

type Props = {
  pulse: FinancePulseResponse;
};

const verdictLabel: Record<FinancePulseVerdict, string> = {
  ok: "Нормально",
  tight: "Пойдет",
  bad: "Плохо",
};

const verdictClass: Record<FinancePulseVerdict, string> = {
  ok: "bg-[#5bd7d3]",
  tight: "bg-[#fff2a3]",
  bad: "bg-[#f188a4]",
};

function deltaText(value: number, currency: string) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatMoney(value, currency)}`;
}

function CategoryRows({
  title,
  items,
  currency,
  emptyText,
}: {
  title: string;
  items: FinancePulseCategory[];
  currency: string;
  emptyText: string;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-black/55">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-black/55">{emptyText}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={`${item.type}-${item.categoryName}`}
              className="flex items-baseline justify-between gap-3 rounded-xl border-2 border-black/10 bg-white/50 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-black">
                  {item.categoryName}
                </div>
                <div className="text-xs text-black/55">
                  {item.sharePct}% · vs прошлый:{" "}
                  {deltaText(item.delta, currency)}
                  {item.deltaPct != null
                    ? ` (${item.deltaPct > 0 ? "+" : ""}${item.deltaPct}%)`
                    : ""}
                </div>
              </div>
              <div className="shrink-0 font-display text-base text-black">
                {formatMoney(item.total, currency)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FinancePulsePanel({ pulse }: Props) {
  const { metrics, currency } = pulse;

  return (
    <GlassCard className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl text-black">Как дела</h2>
          <p className="text-xs text-black/55">
            Период: {pulse.period.from} - {pulse.period.to}
          </p>
        </div>
        <span
          className={`rounded-2xl border-2 border-black/90 px-3 py-1 text-sm font-semibold shadow-[0_3px_0_rgba(0,0,0,0.85)] ${verdictClass[pulse.verdict]}`}
        >
          {verdictLabel[pulse.verdict]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border-2 border-black/15 bg-white/55 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-black/55">
            Доход
          </div>
          <div className="mt-1 font-display text-lg text-teal-700">
            {formatMoney(metrics.periodIncome, currency)}
          </div>
          <div className="mt-1 text-[11px] text-black/50">
            {deltaText(metrics.incomeDelta, currency)}
          </div>
        </div>
        <div className="rounded-2xl border-2 border-black/15 bg-white/55 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-black/55">
            Расход
          </div>
          <div className="mt-1 font-display text-lg text-rose-600">
            {formatMoney(metrics.periodExpense, currency)}
          </div>
          <div className="mt-1 text-[11px] text-black/50">
            {deltaText(metrics.expenseDelta, currency)}
          </div>
        </div>
        <div className="rounded-2xl border-2 border-black/15 bg-white/55 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-black/55">
            Разница
          </div>
          <div
            className={`mt-1 font-display text-lg ${
              metrics.periodNet >= 0 ? "text-teal-700" : "text-rose-600"
            }`}
          >
            {formatMoney(metrics.periodNet, currency)}
          </div>
          <div className="mt-1 text-[11px] text-black/50">
            было {formatMoney(metrics.previousNet, currency)}
          </div>
        </div>
        <div className="rounded-2xl border-2 border-black/15 bg-white/55 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-black/55">
            В наличии
          </div>
          <div className="mt-1 font-display text-lg text-black">
            {formatMoney(metrics.balance, currency)}
          </div>
        </div>
        <div className="rounded-2xl border-2 border-black/15 bg-white/55 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-black/55">
            Доля расходов
          </div>
          <div className="mt-1 font-display text-lg text-black">
            {metrics.expenseRatioPct == null
              ? "—"
              : `${metrics.expenseRatioPct}%`}
          </div>
          <div className="mt-1 text-[11px] text-black/50">от дохода</div>
        </div>
        <div className="rounded-2xl border-2 border-black/15 bg-white/55 p-3">
          <div className="text-[10px] uppercase tracking-[0.14em] text-black/55">
            В день
          </div>
          <div className="mt-1 font-display text-lg text-black">
            {formatMoney(metrics.dailyAverageExpense, currency)}
          </div>
          <div className="mt-1 text-[11px] text-black/50">средний расход</div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CategoryRows
          title="Топ расходов"
          items={pulse.topExpenseCategories}
          currency={currency}
          emptyText="Нет расходов за период"
        />
        <CategoryRows
          title="Топ доходов"
          items={pulse.topIncomeCategories}
          currency={currency}
          emptyText="Нет доходов за период"
        />
      </div>

      {pulse.growingCategories.length > 0 ? (
        <CategoryRows
          title="Что выросло"
          items={pulse.growingCategories}
          currency={currency}
          emptyText=""
        />
      ) : null}

      <p className="text-sm leading-relaxed text-black/80 whitespace-pre-line">
        {pulse.summary}
      </p>

      {pulse.highlights.length > 0 ? (
        <ul className="space-y-1.5">
          {pulse.highlights.map((item, index) => (
            <li
              key={`${index}-${item.slice(0, 24)}`}
              className="rounded-xl border-2 border-black/10 bg-white/45 px-3 py-2 text-sm text-black/80"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-black/50">{pulse.disclaimer}</p>
    </GlassCard>
  );
}
