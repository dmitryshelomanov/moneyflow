import { useSettingsPage } from "@/features/settings/model/use-settings-page";
import { SettingsAccountsSection } from "@/features/settings/ui/settings-accounts-section";
import { SettingsBotHistory } from "@/features/settings/ui/settings-bot-history";
import { SettingsGeneralForm } from "@/features/settings/ui/settings-general-form";
import { SettingsImportCsv } from "@/features/settings/ui/settings-import-csv";
import { GlassCard } from "@/shared/ui/glass-card";

export function SettingsPage() {
  const { state, queries, mutations, actions } = useSettingsPage();

  if (queries.settingsQuery.isPending && !state.settings) {
    return (
      <GlassCard className="mx-auto max-w-2xl">
        <p className="text-sm text-black/60">Загрузка настроек...</p>
      </GlassCard>
    );
  }
  if (!state.settings) {
    return (
      <GlassCard className="mx-auto max-w-2xl">
        <p className="text-sm text-rose-600">Не удалось загрузить настройки</p>
      </GlassCard>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SettingsGeneralForm
        settings={state.settings}
        isSaving={mutations.updateSettingsMutation.isPending}
        saveError={state.saveError}
        saved={state.saved}
        onChange={actions.setSettings}
        onSave={() => void actions.saveSettings()}
        botHistorySlot={
          <SettingsBotHistory
            isPending={mutations.clearBotHistoryMutation.isPending}
            error={state.clearHistoryError}
            doneMessage={state.clearHistoryDone}
            onClear={() => void actions.clearBotHistory()}
          />
        }
      />

      <SettingsAccountsSection
        accounts={state.accounts}
        newAccountName={state.newAccountName}
        newAccountHint={state.newAccountHint}
        newAccountOpening={state.newAccountOpening}
        accountError={state.accountError}
        isCreating={mutations.createAccountMutation.isPending}
        isUpdating={mutations.updateAccountMutation.isPending}
        isDeleting={mutations.deleteAccountMutation.isPending}
        ensureDraft={actions.ensureDraft}
        onNewNameChange={actions.setNewAccountName}
        onNewHintChange={actions.setNewAccountHint}
        onNewOpeningChange={actions.setNewAccountOpening}
        onCreate={() => void actions.createAccount()}
        onPatchDraft={actions.patchDraft}
        onSave={(id, draft) => void actions.saveAccount(id, draft)}
        onDelete={(id) => void actions.deleteAccount(id)}
      />

      <SettingsImportCsv
        csvFile={state.csvFile}
        csvResult={state.csvResult}
        csvError={state.csvError}
        showImportPrompt={state.showImportPrompt}
        importPrompt={state.importPrompt}
        isPending={mutations.importCsvMutation.isPending}
        onFileChange={(file) => {
          actions.setCsvFile(file);
          actions.setCsvResult(null);
          actions.setCsvError(null);
        }}
        onTogglePrompt={() =>
          actions.setShowImportPrompt(!state.showImportPrompt)
        }
        onPromptChange={actions.setImportPrompt}
        onImport={() => void actions.importCsv()}
      />

      <p className="text-xs text-black/45">Версия {__APP_VERSION__}</p>
    </div>
  );
}
