import type { Account } from "@moneyflow/shared";
import { Save, Trash2 } from "lucide-react";
import type { AccountDraft } from "@/features/settings/model/use-settings-page";
import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";
import { Input } from "@/shared/ui/input";

export function SettingsAccountsSection({
  accounts,
  newAccountName,
  newAccountHint,
  newAccountOpening,
  accountError,
  isCreating,
  isUpdating,
  isDeleting,
  ensureDraft,
  onNewNameChange,
  onNewHintChange,
  onNewOpeningChange,
  onCreate,
  onPatchDraft,
  onSave,
  onDelete,
}: {
  accounts: Account[];
  newAccountName: string;
  newAccountHint: string;
  newAccountOpening: string;
  accountError: string | null;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  ensureDraft: (account: Account) => AccountDraft;
  onNewNameChange: (value: string) => void;
  onNewHintChange: (value: string) => void;
  onNewOpeningChange: (value: string) => void;
  onCreate: () => void;
  onPatchDraft: (
    accountId: string,
    draft: AccountDraft,
    patch: Partial<AccountDraft>,
  ) => void;
  onSave: (accountId: string, draft: AccountDraft) => void;
  onDelete: (accountId: string) => void;
}) {
  return (
    <GlassCard className="space-y-4">
      <h3 className="font-display text-xl">Счета</h3>
      <p className="text-sm text-black/65">
        Стартовый баланс задаётся отдельно на каждый счёт. `matchHint` помогает
        ИИ распознавать счет по скринам банка (например: `Т-Банк, Tinkoff,
        *1234`).
      </p>
      <div className="grid gap-3 md:grid-cols-[1.2fr_1.2fr_1fr_auto]">
        <Input
          value={newAccountName}
          placeholder="Название счета"
          onChange={(e) => onNewNameChange(e.target.value)}
        />
        <Input
          value={newAccountHint}
          placeholder="Подсказки для AI (через запятую)"
          onChange={(e) => onNewHintChange(e.target.value)}
        />
        <Input
          placeholder="Стартовый баланс"
          onChange={(e) => onNewOpeningChange(e.target.value)}
          value={newAccountOpening}
        />
        <Button
          disabled={isCreating || !newAccountName.trim()}
          onClick={onCreate}
        >
          Добавить
        </Button>
      </div>

      <div className="space-y-2">
        {accounts.map((account) => {
          const draft = ensureDraft(account);
          const isSavingDraft = isUpdating || isDeleting;
          return (
            <div
              key={account.id}
              className="grid gap-2 rounded-2xl border border-black/10 bg-white/50 p-3 md:grid-cols-[1.2fr_1.2fr_1fr_auto_auto]"
            >
              <Input
                value={draft.name}
                onChange={(e) =>
                  onPatchDraft(account.id, draft, { name: e.target.value })
                }
              />
              <Input
                value={draft.matchHint}
                placeholder="Подсказка для AI"
                onChange={(e) =>
                  onPatchDraft(account.id, draft, {
                    matchHint: e.target.value,
                  })
                }
              />
              <Input
                value={draft.openingBalance}
                placeholder="Стартовый баланс"
                onChange={(e) =>
                  onPatchDraft(account.id, draft, {
                    openingBalance: e.target.value,
                  })
                }
              />
              <Button
                variant="secondary"
                size="icon"
                disabled={isSavingDraft}
                aria-label="Сохранить"
                onClick={() => onSave(account.id, draft)}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size={account.isDefault ? "sm" : "icon"}
                disabled={isSavingDraft || account.isDefault}
                aria-label={account.isDefault ? "Default" : "Удалить"}
                onClick={() => onDelete(account.id)}
              >
                {account.isDefault ? "Default" : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          );
        })}
      </div>
      {accountError ? (
        <p className="text-sm text-rose-600">{accountError}</p>
      ) : null}
    </GlassCard>
  );
}
