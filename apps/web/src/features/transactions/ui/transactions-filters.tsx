import type { Account, Category } from "@moneyflow/shared";
import { DateRangePicker } from "@/widgets/date-range/date-range-picker";
import { Combobox } from "@/shared/ui/combobox";
import { GlassCard } from "@/shared/ui/glass-card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

type TransactionsFiltersProps = {
  q: string;
  from: string;
  to: string;
  type: "" | "expense" | "income";
  accountId: string;
  categoryId: string;
  accounts: Account[];
  categories: Category[];
  allTimeFrom: string | null;
  onQChange: (value: string) => void;
  onPeriodChange: (next: { from: string; to: string }) => void;
  onTypeChange: (value: "" | "expense" | "income") => void;
  onAccountChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
};

function parseTypeFilter(value: string): "" | "expense" | "income" {
  return value === "expense" || value === "income" ? value : "";
}

export function TransactionsFilters({
  q,
  from,
  to,
  type,
  accountId,
  categoryId,
  accounts,
  categories,
  allTimeFrom,
  onQChange,
  onPeriodChange,
  onTypeChange,
  onAccountChange,
  onCategoryChange,
}: TransactionsFiltersProps) {
  const accountOptions = [
    { value: "all", label: "Все счета" },
    ...accounts.map((a) => ({ value: a.id, label: a.name })),
  ];
  const categoryOptions = [
    { value: "all", label: "Все" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <GlassCard className="grid gap-3 md:grid-cols-3">
      <div className="md:col-span-3">
        <Label htmlFor="transactions-search">Поиск</Label>
        <Input
          id="transactions-search"
          type="search"
          className="mt-1"
          value={q}
          onChange={(e) => onQChange(e.target.value)}
          placeholder="Поиск по заметке…"
          autoComplete="off"
        />
      </div>
      <div>
        <Label>Период</Label>
        <div className="mt-1">
          <DateRangePicker
            from={from}
            to={to}
            allTimeFrom={allTimeFrom}
            onChange={onPeriodChange}
            className="w-full"
          />
        </div>
      </div>
      <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
        <div>
          <Label>Тип</Label>
          <Select
            value={type || "all"}
            onValueChange={(value) => onTypeChange(parseTypeFilter(value))}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все</SelectItem>
              <SelectItem value="expense">Расход</SelectItem>
              <SelectItem value="income">Доход</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Счет</Label>
          <Combobox
            className="mt-1"
            value={accountId || "all"}
            onValueChange={(value) =>
              onAccountChange(value === "all" ? "" : value)
            }
            options={accountOptions}
          />
        </div>
        <div>
          <Label>Категория</Label>
          <Combobox
            className="mt-1"
            value={categoryId || "all"}
            onValueChange={(value) =>
              onCategoryChange(value === "all" ? "" : value)
            }
            options={categoryOptions}
          />
        </div>
      </div>
    </GlassCard>
  );
}
