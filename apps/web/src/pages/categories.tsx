import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Category } from "@moneyflow/shared";
import { categoryApi } from "@/entities/category/api/category-api";
import {
  CategoryIcon,
  ICON_OPTIONS,
  resolveCategoryIconName,
} from "@/entities/category/ui/category-icon";
import {
  categoryKeys,
  useCategoriesQuery,
} from "@/entities/category/model/queries";
import { Button } from "@/shared/ui/button";
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
import { Textarea } from "@/shared/ui/textarea";

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [promptDrafts, setPromptDrafts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    type: "expense" as "expense" | "income",
    icon: "Circle",
    prompt: "",
  });

  const categoriesQuery = useCategoriesQuery();

  const createCategoryMutation = useMutation({
    mutationFn: categoryApi.createCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: categoryApi.deleteCategory,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, prompt }: { id: string; prompt: string | null }) =>
      categoryApi.updateCategory(id, { prompt }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
  const items: Category[] = categoriesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <h2 className="font-display text-xl">Новая категория</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Название</Label>
            <Input
              className="mt-1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Тип</Label>
            <Select
              value={form.type}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  type: value as "expense" | "income",
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Расход</SelectItem>
                <SelectItem value="income">Доход</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label>Иконка</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {ICON_OPTIONS.map((icon) => (
              <button
                key={icon}
                type="button"
                onClick={() => setForm({ ...form, icon })}
                className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                  form.icon === icon
                    ? "border-black/90 bg-[#d8fb88]"
                    : "border-black/70 bg-[#fffdf5]"
                }`}
              >
                <CategoryIcon name={icon} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Промпт (опционально)</Label>
          <Textarea
            className="mt-1"
            placeholder="Например: сюда только кофе и выпечка из кафе"
            value={form.prompt}
            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
          />
        </div>
        <Button
          disabled={createCategoryMutation.isPending}
          onClick={async () => {
            if (!form.name.trim()) return;
            await createCategoryMutation.mutateAsync({
              name: form.name.trim(),
              type: form.type,
              icon: resolveCategoryIconName({
                icon: form.icon,
                categoryName: form.name,
                type: form.type,
              }),
              prompt: form.prompt || null,
            });
            setForm({ name: "", type: form.type, icon: "Circle", prompt: "" });
          }}
        >
          Создать
        </Button>
      </GlassCard>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((cat) => (
          <GlassCard key={cat.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-black/90 bg-[#ffe8b8]">
                  <CategoryIcon
                    name={resolveCategoryIconName({
                      icon: cat.icon,
                      categoryName: cat.name,
                      type: cat.type,
                    })}
                    className="h-5 w-5"
                  />
                </div>
                <div>
                  <div className="font-medium text-black">{cat.name}</div>
                  <div className="text-xs uppercase tracking-wider text-black/55">
                    {cat.type === "expense" ? "Расход" : "Доход"}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={deleteCategoryMutation.isPending}
                onClick={async () => {
                  await deleteCategoryMutation.mutateAsync(cat.id);
                }}
              >
                Удалить
              </Button>
            </div>
            <Textarea
              value={promptDrafts[cat.id] ?? cat.prompt ?? ""}
              placeholder="Промпт категории"
              onChange={(e) =>
                setPromptDrafts((prev) => ({
                  ...prev,
                  [cat.id]: e.target.value,
                }))
              }
              onBlur={async () => {
                const promptValue = promptDrafts[cat.id] ?? cat.prompt ?? "";
                await updateCategoryMutation.mutateAsync({
                  id: cat.id,
                  prompt: promptValue || null,
                });
              }}
            />
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
