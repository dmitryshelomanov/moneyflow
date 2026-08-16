import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, ChevronDown, ChevronUp } from "lucide-react";
import type { Category, TransactionType } from "@moneyflow/shared";
import { cn } from "@/shared/lib/cn";
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
  type: TransactionType;
  amount: string;
  note: string;
  occurredAt: string;
  categoryId: string;
};

function parseTransactionType(value: string): TransactionType | null {
  if (value === "expense" || value === "income") return value;
  return null;
}

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
  const [isExpandedMobile, setIsExpandedMobile] = useState(false);
  const categoryOptions = [
    { value: "none", label: "Без категории" },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <GlassCard className="space-y-3">
      <h2 className="hidden font-display text-xl md:block">Добавить вручную</h2>
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-between md:hidden"
        onClick={() => setIsExpandedMobile((prev) => !prev)}
      >
        Добавить вручную
        {isExpandedMobile ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </Button>
      <div className={cn("space-y-3", !isExpandedMobile && "hidden md:block")}>
        <div className="grid gap-3 md:grid-cols-5">
          <Select
            value={form.type}
            onValueChange={(value) => {
              const nextType = parseTransactionType(value);
              if (!nextType) return;
              onChange({ ...form, type: nextType });
            }}
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
      </div>
    </GlassCard>
  );
}
