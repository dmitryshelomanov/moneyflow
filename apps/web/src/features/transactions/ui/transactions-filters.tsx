import type { Category } from "@moneyflow/shared";
import { DateRangePicker } from "@/widgets/date-range/date-range-picker";
import { Combobox } from "@/shared/ui/combobox";
import { GlassCard } from "@/shared/ui/glass-card";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

type TransactionsFiltersProps = {
  from: string;
  to: string;
  type: "" | "expense" | "income";
  categoryId: string;
  categories: Category[];
  allTimeFrom: string | null;
  onPeriodChange: (next: { from: string; to: string }) => void;
  onTypeChange: (value: "" | "expense" | "income") => void;
  onCategoryChange: (value: string) => void;
};

export function TransactionsFilters({
  from,
  to,
  type,
  categoryId,
  categories,
  allTimeFrom,
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
      <div>
        <Label>Тип</Label>
        <Select
          value={type || "all"}
          onValueChange={(value) =>
            onTypeChange(value === "all" ? "" : (value as typeof type))
          }
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
    </GlassCard>
  );
}
