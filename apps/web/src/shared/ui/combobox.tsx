import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/shared/lib/cn";
import { isCoarsePointer } from "@/shared/lib/pointer";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

export type ComboboxOption = {
  value: string;
  label: string;
};

type ComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
};

export function Combobox({
  value,
  onValueChange,
  options,
  placeholder = "Выберите…",
  searchPlaceholder = "Поиск…",
  emptyText = "Ничего не найдено",
  className,
  contentClassName,
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);
  const query = search.trim().toLowerCase();
  const filtered = query
    ? options.filter((option) => option.label.toLowerCase().includes(query))
    : options;

  React.useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (disabled) return;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "flex h-11 w-full items-center justify-between rounded-2xl border-2 border-black/90 bg-[#fffdf5] px-4 text-sm text-black shadow-[0_3px_0_rgba(0,0,0,0.8)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        >
          <span className={cn("truncate", !selected && "text-black/45")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-black/60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(
          "w-[var(--radix-popover-trigger-width)] min-w-[14rem] overflow-hidden p-0",
          contentClassName,
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (isCoarsePointer()) return;
          inputRef.current?.focus();
        }}
      >
        <div className="border-b border-black/10 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/40" />
            <input
              ref={inputRef}
              value={search}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-xl border-2 border-black/90 bg-[#fffdf5] py-1.5 pl-9 pr-3 text-base text-black outline-none placeholder:text-black/40 focus-visible:ring-2 focus-visible:ring-black/20 md:text-sm"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setOpen(false);
                }
              }}
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-black/45">
              {emptyText}
            </div>
          ) : (
            filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "relative flex w-full cursor-default items-center rounded-xl py-2 pl-8 pr-2 text-left text-sm outline-none",
                    "hover:bg-[#d8fb88] focus:bg-[#d8fb88] focus-visible:bg-[#d8fb88]",
                  )}
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  {isSelected ? (
                    <Check className="absolute left-2.5 h-4 w-4" />
                  ) : null}
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
