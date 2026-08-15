import { formatMoney } from "@moneyflow/shared";
import { useNavigate } from "react-router-dom";
import { useDashboard } from "@/features/dashboard/model/use-dashboard";
import { DateRangePicker } from "@/widgets/date-range/date-range-picker";
import { CashflowChart } from "@/widgets/charts/cashflow-chart";
import { CategoryPieChart } from "@/widgets/charts/category-pie-chart";
import { TotalMoneyChart } from "@/widgets/charts/total-money-chart";
import { WaterfallChart } from "@/widgets/charts/waterfall-chart";
import { BurnRateChart } from "@/widgets/charts/burn-rate-chart";
import { ParetoChart } from "@/widgets/charts/pareto-chart";
import { SpendingHeatmapChart } from "@/widgets/charts/spending-heatmap-chart";
import { useAiSavings } from "@/features/ai-savings/model/use-ai-savings";
import { SavingsAdvicePanel } from "@/features/ai-savings/ui/savings-advice-panel";
import { useAiPulse } from "@/features/ai-pulse/model/use-ai-pulse";
import { FinancePulsePanel } from "@/features/ai-pulse/ui/finance-pulse-panel";
import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

function deltaLabel(value: number | null, currency: string, suffix = "") {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  if (suffix) return `${sign}${value}${suffix}`;
  return `${sign}${formatMoney(value, currency)}`;
}

export function DashboardPage() {
  const { state, actions, mutations } = useDashboard();
  const aiSavings = useAiSavings();
  const aiPulse = useAiPulse();
  const navigate = useNavigate();
  const currency = state.summary?.currency ?? "RUB";

  const exportCsv = () => {
    const rows = [
      ["date", "income_minor", "expense_minor"],
      ...state.series.map((point) => [
        point.date,
        String(point.income),
        String(point.expense),
      ]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `moneyflow-${state.from}-${state.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <DateRangePicker
        from={state.from}
        to={state.to}
        allTimeFrom={state.allTimeFrom}
        large
        onChange={({ from: nextFrom, to: nextTo }) => {
          actions.setFrom(nextFrom);
          actions.setTo(nextTo);
        }}
      />
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size="sm"
          variant="default"
          disabled={!state.summary || aiPulse.isPending}
          onClick={async () => {
            try {
              await aiPulse.requestPulse({
                from: state.from,
                to: state.to,
              });
            } catch {
              // Error state is rendered below action buttons.
            }
          }}
        >
          {aiPulse.isPending ? "Смотрю..." : "Как дела?"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!state.summary || aiSavings.isPending}
          onClick={async () => {
            try {
              await aiSavings.requestAdvice({
                from: state.from,
                to: state.to,
                maxTips: 5,
              });
            } catch {
              // Error state is rendered below action buttons.
            }
          }}
        >
          {aiSavings.isPending ? "Ищу варианты..." : "Где сэкономить?"}
        </Button>
        <Button size="sm" variant="ghost" onClick={exportCsv}>
          Экспорт CSV
        </Button>
      </div>
      {aiPulse.error && (
        <p className="text-sm text-rose-600">
          {aiPulse.error instanceof Error
            ? aiPulse.error.message
            : "Не удалось получить оценку"}
        </p>
      )}
      {aiSavings.error && (
        <p className="text-sm text-rose-600">
          {aiSavings.error instanceof Error
            ? aiSavings.error.message
            : "Не удалось получить советы"}
        </p>
      )}
      {state.isLongRange ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-black/50">
            Группировка
          </span>
          <Button
            size="sm"
            variant={
              state.longRangeGranularity === "year" ? "secondary" : "ghost"
            }
            onClick={() => actions.setLongRangeGranularity("year")}
          >
            По годам
          </Button>
          <Button
            size="sm"
            variant={
              state.longRangeGranularity === "month" ? "secondary" : "ghost"
            }
            onClick={() => actions.setLongRangeGranularity("month")}
          >
            По месяцам
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-4">
        <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-black/55 md:text-xs md:tracking-[0.16em]">
            Баланс
          </div>
          <div className="mt-1 font-display text-lg leading-tight text-black md:mt-2 md:text-3xl">
            {state.summary
              ? formatMoney(state.summary.balance, state.summary.currency)
              : "—"}
          </div>
          <div className="mt-1 text-[11px] text-black/55 md:text-xs">
            vs прошлый период: {deltaLabel(state.delta.balance, currency)}
          </div>
        </GlassCard>
        <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-black/55 md:text-xs md:tracking-[0.16em]">
            Доход за период
          </div>
          <div className="mt-1 font-display text-lg leading-tight text-teal-700 md:mt-2 md:text-3xl">
            {state.summary
              ? formatMoney(state.summary.periodIncome, state.summary.currency)
              : "—"}
          </div>
          <div className="mt-1 text-[11px] text-black/55 md:text-xs">
            vs прошлый период: {deltaLabel(state.delta.periodIncome, currency)}
          </div>
        </GlassCard>
        <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-black/55 md:text-xs md:tracking-[0.16em]">
            Расход за период
          </div>
          <div className="mt-1 font-display text-lg leading-tight text-rose-600 md:mt-2 md:text-3xl">
            {state.summary
              ? formatMoney(state.summary.periodExpense, state.summary.currency)
              : "—"}
          </div>
          <div className="mt-1 text-[11px] text-black/55 md:text-xs">
            vs прошлый период: {deltaLabel(state.delta.periodExpense, currency)}
          </div>
        </GlassCard>
        <GlassCard className="rounded-2xl p-3 md:rounded-[28px] md:p-5">
          <div className="text-[10px] uppercase tracking-[0.14em] text-black/55 md:text-xs md:tracking-[0.16em]">
            Доля расходов
          </div>
          <div className="mt-1 font-display text-lg leading-tight text-black md:mt-2 md:text-3xl">
            {state.ratio == null ? "—" : `${state.ratio}%`}
          </div>
          <div className="mt-1 text-[11px] text-black/55 md:text-xs">
            {state.ratio == null
              ? "нет дохода в периоде"
              : "от дохода за период"}
          </div>
          <div className="mt-1 text-[11px] text-black/55 md:text-xs">
            vs прошлый период:{" "}
            {deltaLabel(state.delta.ratio, currency, " п.п.")}
          </div>
        </GlassCard>
      </div>

      {aiPulse.data ? <FinancePulsePanel pulse={aiPulse.data} /> : null}
      {aiSavings.data ? <SavingsAdvicePanel advice={aiSavings.data} /> : null}

      <GlassCard>
        <TotalMoneyChart
          series={state.balanceSeries}
          currency={state.summary?.currency ?? "RUB"}
          balance={state.summary?.balance ?? 0}
          averageExpensePerMonthMinor={state.averageExpensePerMonthMinor}
          from={state.from}
          to={state.to}
          granularity={state.balanceGranularity}
        />
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-5">
        <GlassCard className="lg:col-span-3">
          <CashflowChart
            series={state.series}
            currency={state.summary?.currency ?? "RUB"}
            periodIncome={state.summary?.periodIncome ?? 0}
            periodExpense={state.summary?.periodExpense ?? 0}
            from={state.from}
            to={state.to}
            granularity={state.granularity}
          />
        </GlassCard>

        <GlassCard className="lg:col-span-2">
          <h2 className="mb-4 font-display text-xl text-black">
            Расходы по категориям
          </h2>
          <CategoryPieChart
            items={state.expenseCats}
            currency={state.summary?.currency ?? "RUB"}
            emptyLabel="Нет расходов за период"
            onSliceClick={(slice) => {
              if (!slice.categoryId) return;
              const params = new URLSearchParams({
                from: state.from,
                to: state.to,
                type: "expense",
                categoryId: slice.categoryId,
              });
              navigate(`/transactions?${params.toString()}`);
            }}
          />
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <WaterfallChart
            currency={currency}
            balance={state.summary?.balance ?? 0}
            periodIncome={state.summary?.periodIncome ?? 0}
            periodExpense={state.summary?.periodExpense ?? 0}
          />
        </GlassCard>
        <GlassCard>
          <BurnRateChart
            from={state.from}
            to={state.to}
            currency={currency}
            daySeries={state.daySeries}
          />
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard>
          <ParetoChart items={state.expensePareto} currency={currency} />
        </GlassCard>
        <GlassCard>
          <SpendingHeatmapChart
            cells={state.expenseHeatmap}
            currency={currency}
          />
        </GlassCard>
      </div>

      <GlassCard>
        <h2 className="mb-4 font-display text-xl text-black">
          Доходы по категориям
        </h2>
        <CategoryPieChart
          items={state.incomeCats}
          currency={state.summary?.currency ?? "RUB"}
          emptyLabel="Нет доходов за период"
          onSliceClick={(slice) => {
            if (!slice.categoryId) return;
            const params = new URLSearchParams({
              from: state.from,
              to: state.to,
              type: "income",
              categoryId: slice.categoryId,
            });
            navigate(`/transactions?${params.toString()}`);
          }}
        />
      </GlassCard>

      <GlassCard className="space-y-3">
        <Label>Быстрая запись</Label>
        <div className="flex flex-col gap-3 md:flex-row">
          <Input
            placeholder="кофе 350 или зарплата 100000"
            value={state.quickText}
            onChange={(e) => actions.setQuickText(e.target.value)}
          />
          <Button
            disabled={
              mutations.parseMutation.isPending || !state.quickText.trim()
            }
            onClick={async () => {
              actions.setMessage(null);
              try {
                await mutations.parseMutation.mutateAsync();
              } catch (err) {
                actions.setMessage(
                  err instanceof Error ? err.message : "Ошибка",
                );
              }
            }}
          >
            Разобрать
          </Button>
        </div>
        {state.message && (
          <p className="text-sm text-black/65">{state.message}</p>
        )}
      </GlassCard>
    </div>
  );
}
