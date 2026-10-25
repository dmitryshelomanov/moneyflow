import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type Account,
  fromMinorUnits,
  type ImportCsvAiResponse,
  type Settings,
} from "@moneyflow/shared";
import { accountApi } from "@/entities/account/api/account-api";
import { useAccountsQuery } from "@/entities/account/model/queries";
import { settingsApi } from "@/entities/settings/api/settings-api";
import { useSettingsQuery } from "@/entities/settings/model/queries";
import { importCsvAiApi } from "@/features/settings-import/api/import-csv-ai-api";
import { getErrorMessage } from "@/shared/api/http";
import { parseDecimalInput } from "@/shared/lib/number";
import { invalidateFinancialData } from "@/shared/lib/query-cache";

export type AccountDraft = {
  name: string;
  matchHint: string;
  openingBalance: string;
};

export function useSettingsPage() {
  const queryClient = useQueryClient();
  const settingsQuery = useSettingsQuery();
  const accountsQuery = useAccountsQuery();

  const updateSettingsMutation = useMutation({
    mutationFn: settingsApi.updateSettings,
  });
  const clearBotHistoryMutation = useMutation({
    mutationFn: settingsApi.clearBotHistory,
  });
  const importCsvMutation = useMutation({
    mutationFn: async (payload: { file: File; promptExtension?: string }) => {
      const { file, promptExtension } = payload;
      const csv = await file.text();
      return importCsvAiApi.importCsv({
        csv,
        filename: file.name,
        promptExtension: promptExtension?.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await invalidateFinancialData(queryClient, {
        transactions: true,
        categories: true,
        statsMeta: true,
        dashboard: true,
      });
    },
  });
  const createAccountMutation = useMutation({
    mutationFn: accountApi.createAccount,
    onSuccess: async () => {
      await invalidateFinancialData(queryClient, {
        accounts: true,
        transactions: true,
        dashboard: true,
      });
    },
  });
  const updateAccountMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        name: string;
        matchHint: string | null;
        openingBalance: number;
      };
    }) => accountApi.updateAccount(id, payload),
    onSuccess: async () => {
      await invalidateFinancialData(queryClient, {
        accounts: true,
        dashboard: true,
      });
    },
  });
  const deleteAccountMutation = useMutation({
    mutationFn: accountApi.deleteAccount,
    onSuccess: async () => {
      await invalidateFinancialData(queryClient, {
        accounts: true,
        transactions: true,
        dashboard: true,
      });
    },
  });

  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvResult, setCsvResult] = useState<ImportCsvAiResponse | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showImportPrompt, setShowImportPrompt] = useState(false);
  const [importPrompt, setImportPrompt] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountHint, setNewAccountHint] = useState("");
  const [newAccountOpening, setNewAccountOpening] = useState("0");
  const [accountDrafts, setAccountDrafts] = useState<
    Record<string, AccountDraft>
  >({});
  const [accountError, setAccountError] = useState<string | null>(null);
  const [clearHistoryError, setClearHistoryError] = useState<string | null>(
    null,
  );
  const [clearHistoryDone, setClearHistoryDone] = useState<string | null>(null);

  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setSettings((prev) => {
      if (
        prev &&
        prev.currency === s.currency &&
        prev.categorizationPrompt === s.categorizationPrompt &&
        prev.aiModel === s.aiModel &&
        prev.allowedTelegramIds === s.allowedTelegramIds
      ) {
        return prev;
      }
      return s;
    });
  }, [settingsQuery.data]);

  const accounts = accountsQuery.data ?? [];

  const ensureDraft = (account: Account): AccountDraft =>
    accountDrafts[account.id] ?? {
      name: account.name,
      matchHint: account.matchHint ?? "",
      openingBalance: String(fromMinorUnits(account.openingBalance)),
    };

  const patchDraft = (accountId: string, draft: AccountDraft, patch: Partial<AccountDraft>) => {
    setAccountDrafts((prev) => ({
      ...prev,
      [accountId]: { ...draft, ...patch },
    }));
  };

  const clearDraft = (accountId: string) => {
    setAccountDrafts((prev) => {
      const next = { ...prev };
      delete next[accountId];
      return next;
    });
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaveError(null);
    try {
      const updated = await updateSettingsMutation.mutateAsync({
        currency: settings.currency,
        categorizationPrompt: settings.categorizationPrompt,
        allowedTelegramIds: settings.allowedTelegramIds,
      });
      await invalidateFinancialData(queryClient, {
        statsMeta: true,
        dashboard: true,
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (error) {
      setSaveError(getErrorMessage(error, "Не удалось сохранить настройки"));
    }
  };

  const clearBotHistory = async () => {
    if (
      !window.confirm(
        "Очистить историю чата с ботом? Останется только приветствие. Старые неотслеженные сообщения не удалятся.",
      )
    ) {
      return;
    }
    setClearHistoryError(null);
    setClearHistoryDone(null);
    try {
      const result = await clearBotHistoryMutation.mutateAsync();
      setClearHistoryDone(
        result.keptGreeting
          ? `Удалено сообщений: ${result.deleted}. Приветствие сохранено.`
          : `Удалено сообщений: ${result.deleted}. Приветствие отправить не удалось.`,
      );
    } catch (error) {
      setClearHistoryError(
        getErrorMessage(error, "Не удалось очистить историю бота"),
      );
    }
  };

  const createAccount = async () => {
    setAccountError(null);
    try {
      const parsedOpening = parseDecimalInput(newAccountOpening);
      if (parsedOpening == null) {
        setAccountError("Некорректный стартовый баланс счета");
        return;
      }
      await createAccountMutation.mutateAsync({
        name: newAccountName.trim(),
        matchHint: newAccountHint.trim() || null,
        openingBalance: parsedOpening,
      });
      setNewAccountName("");
      setNewAccountHint("");
      setNewAccountOpening("0");
    } catch (error) {
      setAccountError(getErrorMessage(error, "Не удалось создать счет"));
    }
  };

  const saveAccount = async (accountId: string, draft: AccountDraft) => {
    setAccountError(null);
    try {
      const parsedOpening = parseDecimalInput(draft.openingBalance);
      if (parsedOpening == null) {
        setAccountError("Некорректный стартовый баланс счета");
        return;
      }
      await updateAccountMutation.mutateAsync({
        id: accountId,
        payload: {
          name: draft.name.trim(),
          matchHint: draft.matchHint.trim() || null,
          openingBalance: parsedOpening,
        },
      });
      clearDraft(accountId);
    } catch (error) {
      setAccountError(getErrorMessage(error, "Не удалось обновить счет"));
    }
  };

  const deleteAccount = async (accountId: string) => {
    setAccountError(null);
    if (!window.confirm("Удалить счет?")) return;
    try {
      await deleteAccountMutation.mutateAsync(accountId);
    } catch (error) {
      setAccountError(getErrorMessage(error, "Не удалось удалить счет"));
    }
  };

  const importCsv = async () => {
    if (!csvFile) return;
    setCsvError(null);
    try {
      const result = await importCsvMutation.mutateAsync({
        file: csvFile,
        promptExtension: showImportPrompt ? importPrompt : undefined,
      });
      setCsvResult(result);
    } catch (error) {
      setCsvResult(null);
      setCsvError(getErrorMessage(error, "Не удалось импортировать CSV"));
    }
  };

  return {
    queries: { settingsQuery, accountsQuery },
    state: {
      settings,
      saved,
      saveError,
      clearHistoryError,
      clearHistoryDone,
      accounts,
      newAccountName,
      newAccountHint,
      newAccountOpening,
      accountError,
      csvFile,
      csvResult,
      csvError,
      showImportPrompt,
      importPrompt,
    },
    mutations: {
      updateSettingsMutation,
      clearBotHistoryMutation,
      createAccountMutation,
      updateAccountMutation,
      deleteAccountMutation,
      importCsvMutation,
    },
    actions: {
      setSettings,
      setNewAccountName,
      setNewAccountHint,
      setNewAccountOpening,
      setCsvFile,
      setCsvResult,
      setCsvError,
      setShowImportPrompt,
      setImportPrompt,
      ensureDraft,
      patchDraft,
      saveSettings,
      clearBotHistory,
      createAccount,
      saveAccount,
      deleteAccount,
      importCsv,
    },
  };
}
