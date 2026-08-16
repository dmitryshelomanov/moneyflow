/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TELEGRAM_BOT_ID?: string;
  readonly VITE_ACCESS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
