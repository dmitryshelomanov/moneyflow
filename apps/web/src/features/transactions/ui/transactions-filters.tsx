import type { Category } from "@moneyflow/shared";
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
  categoryId: string;
  categories: Category[];
  allTimeFrom: string | null;
  onQChange: (value: string) => void;
  onPeriodChange: (next: { from: string; to: string }) => void;
  onTypeChange: (value: "" | "expense" | "income") => void;
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
  categoryId,
  categories,
  allTimeFrom,
  onQChange,
  onPeriodChange,
  onTypeChange,
  onCategoryChange,
}: TransactionsFiltersProps) {
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
      <div className="grid grid-cols-2 gap-3 md:col-span-2">
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
