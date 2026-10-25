const SAFE_TELEGRAM_FILE_PATH = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

/** Relative Telegram file_path only. Rejects schemes, traversal, and URLs. */
export function isSafeTelegramFilePath(filePath: string): boolean {
  if (filePath.length === 0 || filePath.length > 512) return false;
  if (filePath.includes("..") || filePath.includes("\\")) return false;
  if (filePath.startsWith("/")) return false;
  if (filePath.includes("://") || filePath.includes("@")) return false;
  return SAFE_TELEGRAM_FILE_PATH.test(filePath);
}
