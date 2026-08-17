export type MfRuntimeConfig = {
  telegramBotId?: string;
};

declare global {
  interface Window {
    __MF_CONFIG__?: MfRuntimeConfig;
  }
}

export function getTelegramBotId(): string | undefined {
  if (typeof window !== "undefined") {
    const fromWindow = window.__MF_CONFIG__?.telegramBotId?.trim();
    if (fromWindow) return fromWindow;
  }
  const fromEnv = import.meta.env.VITE_TELEGRAM_BOT_ID?.trim();
  return fromEnv || undefined;
}

export function themeAsset(file: string): string {
  return `${import.meta.env.BASE_URL}theme/${file}`;
}
