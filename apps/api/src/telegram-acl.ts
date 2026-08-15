import { allowedTelegramIds, env, parseTelegramIds } from "./env.js";
import { getSettings } from "./services/money.js";

export function getAllowedTelegramIds(): Set<number> {
  const fromDb = parseTelegramIds(getSettings().allowedTelegramIds);
  return new Set([...allowedTelegramIds, ...fromDb]);
}

export function isTelegramAllowed(id: number): boolean {
  const ids = getAllowedTelegramIds();
  if (ids.size === 0) return env.NODE_ENV === "development";
  return ids.has(id);
}
