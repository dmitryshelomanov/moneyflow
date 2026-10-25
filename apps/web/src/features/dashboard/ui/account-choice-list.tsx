import { Check } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export function AccountChoiceList({
  accounts,
  selectedId,
  onSelect,
  includeAll = false,
}: {
  accounts: Array<{ id: string; name: string }>;
  selectedId: string;
  onSelect: (id: string) => void;
  includeAll?: boolean;
}) {
  const items = includeAll
    ? [{ id: "", name: "Все счета" }, ...accounts]
    : accounts;

  return (
    <div className="space-y-2">
      {items.map((account) => {
        const isActive = account.id === selectedId;
        return (
          <button
            key={account.id || "all"}
            type="button"
            className={cn(
              "flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3 text-left text-sm transition",
              isActive
                ? "border-black bg-[#d8fb88]"
                : "border-black/20 bg-white hover:border-black/50",
            )}
            onClick={() => onSelect(account.id)}
          >
            <span className="font-medium">{account.name}</span>
            {isActive ? <Check className="h-4 w-4" /> : null}
          </button>
        );
      })}
    </div>
  );
}
