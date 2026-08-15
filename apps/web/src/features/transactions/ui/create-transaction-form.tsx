import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { Category } from "@moneyflow/shared";
import { formatYmd, parseYmd } from "@/shared/lib/date";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Combobox } from "@/shared/ui/combobox";
import { GlassCard } from "@/shared/ui/glass-card";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";

type TransactionForm = {
  type: "expense" | "income";
  amount: string;
  note: string;
  occurredAt: string;
  categoryId: string;
};

type CreateTransactionFormProps = {
  form: TransactionForm;
  categories: Category[];
  isSaving: boolean;
  error: string | null;
  onChange: (next: TransactionForm) => void;
  onSubmit: () => Promise<void>;
};

export function CreateTransactionForm({
  form,
  categories,
  isSaving,
  error,
  onChange,
  onSubmit,
}: CreateTransactionFormProps) {
  const categoryOptions = [
    { value: "none", label: "Без категории" },
    ...categories
      .filter((c) => c.type === form.type)
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <GlassCard className="space-y-3">
      <h2 className="font-display text-xl">Добавить вручную</h2>
      <div className="grid gap-3 md:grid-cols-5">
        <Select
          value={form.type}
          onValueChange={(value) =>
            onChange({ ...form, type: value as "expense" | "income" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expense">Расход</SelectItem>
            <SelectItem value="income">Доход</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Сумма"
          value={form.amount}
          onChange={(e) => onChange({ ...form, amount: e.target.value })}
        />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              className="h-11 justify-start rounded-2xl px-4 text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-sky-600" />
              {format(parseYmd(form.occurredAt), "d MMM yyyy", {
                locale: ru,
              })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              locale={ru}
              selected={parseYmd(form.occurredAt)}
              onSelect={(next) => {
                if (!next) return;
                onChange({ ...form, occurredAt: formatYmd(next) });
              }}
            />
          </PopoverContent>
        </Popover>
        <Combobox
          value={form.categoryId || "none"}
          onValueChange={(value) =>
            onChange({ ...form, categoryId: value === "none" ? "" : value })
          }
          options={categoryOptions}
        />
        <Input
          placeholder="Заметка"
          value={form.note}
          onChange={(e) => onChange({ ...form, note: e.target.value })}
        />
      </div>
      <Button disabled={isSaving} onClick={() => void onSubmit()}>
        Сохранить
      </Button>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </GlassCard>
  );
}
