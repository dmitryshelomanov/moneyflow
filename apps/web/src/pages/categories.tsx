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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { GlassCard } from "@/shared/ui/glass-card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/cn";
import { isCoarsePointer } from "@/shared/lib/pointer";

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [form, setForm] = useState({
    name: "",
    icon: "Circle",
    prompt: "",
  });
  const [mutationError, setMutationError] = useState<string | null>(null);

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
  const selected = items.find((cat) => cat.id === selectedId) ?? null;

  function openCategory(cat: Category) {
    setSelectedId(cat.id);
    setPromptDraft(cat.prompt ?? "");
  }

  function closeCategory() {
    setSelectedId(null);
    setPromptDraft("");
  }

  async function savePrompt() {
    if (!selected) return;
    const nextPrompt = promptDraft.trim() || null;
    const currentPrompt = selected.prompt ?? null;
    setMutationError(null);
    if (nextPrompt !== currentPrompt) {
      try {
        await updateCategoryMutation.mutateAsync({
          id: selected.id,
          prompt: nextPrompt,
        });
      } catch (error) {
        setMutationError(
          error instanceof Error
            ? error.message
            : "Не удалось сохранить категорию",
        );
        return;
      }
    }
    closeCategory();
  }

  return (
    <div className="space-y-6">
      <GlassCard className="space-y-4">
        <h2 className="font-display text-xl">Новая категория</h2>
        <div>
          <Label>Название</Label>
          <Input
            className="mt-1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
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
            setMutationError(null);
            try {
              await createCategoryMutation.mutateAsync({
                name: form.name.trim(),
                icon: resolveCategoryIconName({
                  icon: form.icon,
                  categoryName: form.name,
                }),
                prompt: form.prompt || null,
              });
              setForm({ name: "", icon: "Circle", prompt: "" });
            } catch (error) {
              setMutationError(
                error instanceof Error
                  ? error.message
                  : "Не удалось создать категорию",
              );
            }
          }}
        >
          Создать
        </Button>
        {mutationError && (
          <p className="text-sm text-rose-600">{mutationError}</p>
        )}
      </GlassCard>

      {categoriesQuery.isPending && (
        <GlassCard>
          <p className="text-sm text-black/60">Загрузка категорий...</p>
        </GlassCard>
      )}
      {categoriesQuery.isError && (
        <GlassCard className="space-y-3">
          <p className="text-sm text-rose-600">
            {categoriesQuery.error instanceof Error
              ? categoriesQuery.error.message
              : "Не удалось загрузить категории"}
          </p>
          <Button size="sm" onClick={() => void categoriesQuery.refetch()}>
            Повторить
          </Button>
        </GlassCard>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((cat) => {
          const hasPrompt = Boolean(cat.prompt?.trim());
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => openCategory(cat)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border-2 border-black/90 bg-[#fffdf5] p-3 text-left shadow-[0_5px_0_rgba(0,0,0,0.82)] transition",
                "hover:-translate-y-0.5 hover:bg-[#fff8e6] active:translate-y-0.5 active:shadow-[0_2px_0_rgba(0,0,0,0.82)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/35",
                selectedId === cat.id && "bg-[#d8fb88]",
              )}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-black/90 bg-[#ffe8b8]">
                <CategoryIcon
                  name={resolveCategoryIconName({
                    icon: cat.icon,
                    categoryName: cat.name,
                  })}
                  className="h-5 w-5"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-black">
                  {cat.name}
                </div>
                <div className="mt-0.5 truncate text-xs text-black/50">
                  {hasPrompt ? "Промпт задан" : "Без промпта"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) closeCategory();
        }}
      >
        <DialogContent>
          {selected ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-black/90 bg-[#ffe8b8]">
                    <CategoryIcon
                      name={resolveCategoryIconName({
                        icon: selected.icon,
                        categoryName: selected.name,
                      })}
                      className="h-5 w-5"
                    />
                  </div>
                  <div>
                    <DialogTitle>{selected.name}</DialogTitle>
                    <DialogDescription>
                      Промпт помогает точнее относить операции к категории
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div>
                <Label htmlFor="category-prompt">Промпт категории</Label>
                <Textarea
                  id="category-prompt"
                  className="mt-1"
                  autoFocus={!isCoarsePointer()}
                  placeholder="Например: аптека, лекарства, БАДы"
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={deleteCategoryMutation.isPending}
                  onClick={async () => {
                    if (
                      !window.confirm(`Удалить категорию «${selected.name}»?`)
                    )
                      return;
                    setMutationError(null);
                    try {
                      await deleteCategoryMutation.mutateAsync(selected.id);
                      closeCategory();
                    } catch (error) {
                      setMutationError(
                        error instanceof Error
                          ? error.message
                          : "Не удалось удалить категорию",
                      );
                    }
                  }}
                >
                  Удалить
                </Button>
                <Button
                  disabled={updateCategoryMutation.isPending}
                  onClick={() => void savePrompt()}
                >
                  Сохранить
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
