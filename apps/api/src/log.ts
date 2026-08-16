import { env } from "./env.js";

const isDev = env.NODE_ENV === "development";

function ts() {
  return new Date().toISOString().slice(11, 23);
}

function fmt(scope: string, message: string, data?: unknown) {
  const base = `[${ts()}] [${scope}] ${message}`;
  if (data === undefined) return base;
  try {
    return `${base} ${JSON.stringify(data)}`;
  } catch {
    return `${base} [unserializable]`;
  }
}

export const log = {
  debug(scope: string, message: string, data?: unknown) {
    if (!isDev) return;
    console.log(fmt(scope, message, data));
  },
  info(scope: string, message: string, data?: unknown) {
    console.info(fmt(scope, message, data));
  },
  warn(scope: string, message: string, data?: unknown) {
    console.warn(fmt(scope, message, data));
  },
  error(scope: string, message: string, data?: unknown) {
    console.error(fmt(scope, message, data));
  },
};
