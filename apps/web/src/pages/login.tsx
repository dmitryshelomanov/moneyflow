import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { TelegramAuthSchema, type TelegramAuth } from "@moneyflow/shared";
import { sessionApi } from "@/entities/session/api/session-api";
import { useAuth } from "@/features/auth/model/auth-context";
import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";

const submittedTelegramHashes = new Set<string>();

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad =
    padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

function parseTelegramAuth(raw: unknown): TelegramAuth | null {
  const parsed = TelegramAuthSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function parseTelegramAuthFromLocation(): TelegramAuth | null {
  if (typeof window === "undefined") return null;

  const stripPrefix = (raw: string) =>
    raw.startsWith("?") || raw.startsWith("#") ? raw.slice(1) : raw;

  const fromTgAuthResult = (raw: string) => {
    const params = new URLSearchParams(stripPrefix(raw));
    const encoded = params.get("tgAuthResult");
    if (!encoded) return null;
    try {
      return parseTelegramAuth(JSON.parse(decodeBase64Url(encoded)));
    } catch {
      return null;
    }
  };

  const fromFlatParams = (raw: string) => {
    const params = new URLSearchParams(stripPrefix(raw));
    const id = Number(params.get("id"));
    const authDate = Number(params.get("auth_date"));
    const firstName = params.get("first_name");
    const hash = params.get("hash");
    if (!firstName || !hash || Number.isNaN(id) || Number.isNaN(authDate)) {
      return null;
    }
    return parseTelegramAuth({
      id,
      first_name: firstName,
      last_name: params.get("last_name") ?? undefined,
      username: params.get("username") ?? undefined,
      photo_url: params.get("photo_url") ?? undefined,
      auth_date: authDate,
      hash,
    });
  };

  return (
    fromTgAuthResult(window.location.hash) ??
    fromTgAuthResult(window.location.search) ??
    fromFlatParams(window.location.search) ??
    fromFlatParams(window.location.hash)
  );
}

export function LoginPage() {
  const { user, loading, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const jakeBg = `${import.meta.env.BASE_URL}theme/jake.png`;
  const finnBg = `${import.meta.env.BASE_URL}theme/finn.png`;
  const botId = import.meta.env.VITE_TELEGRAM_BOT_ID as string | undefined;

  const telegramAuthMutation = useMutation({
    mutationFn: (payload: TelegramAuth) => sessionApi.telegramAuth(payload),
  });
  const { mutateAsync: telegramAuth } = telegramAuthMutation;
  const devLoginMutation = useMutation({
    mutationFn: () => sessionApi.devLogin({ name: "Dev User" }),
  });

  const telegramAuthUrl = useMemo(() => {
    if (!botId || typeof window === "undefined") return null;
    const returnTo = `${window.location.origin}${window.location.pathname}`;
    const url = new URL("https://oauth.telegram.org/auth");
    url.searchParams.set("bot_id", botId);
    url.searchParams.set("origin", window.location.origin);
    url.searchParams.set("request_access", "write");
    url.searchParams.set("return_to", returnTo);
    return url.toString();
  }, [botId]);

  useEffect(() => {
    const payload = parseTelegramAuthFromLocation();
    if (!payload || submittedTelegramHashes.has(payload.hash)) return;
    submittedTelegramHashes.add(payload.hash);
    let cancelled = false;
    let finished = false;
    (async () => {
      try {
        await telegramAuth(payload);
        if (!cancelled) {
          await refresh();
        }
      } catch (err) {
        submittedTelegramHashes.delete(payload.hash);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ошибка входа");
        }
      } finally {
        finished = true;
        if (!cancelled && typeof window !== "undefined") {
          window.history.replaceState(
            null,
            document.title,
            window.location.pathname,
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      if (!finished) submittedTelegramHashes.delete(payload.hash);
    };
  }, [refresh, telegramAuth]);

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0">
        <img
          src={finnBg}
          alt=""
          aria-hidden="true"
          className="absolute -left-5 bottom-6 w-24 opacity-20 md:left-6 md:bottom-10 md:w-36"
        />
        <img
          src={jakeBg}
          alt=""
          aria-hidden="true"
          className="absolute -right-3 top-16 w-20 opacity-20 md:right-8 md:top-14 md:w-32"
        />
        <div className="absolute left-10 top-16 h-20 w-20 rounded-full border-2 border-black/20 bg-[#ffd1de]" />
        <div className="absolute bottom-10 right-10 h-24 w-24 rounded-full border-2 border-black/20 bg-[#c8f6ff]" />
      </div>
      <GlassCard className="relative w-full max-w-md space-y-6 text-center">
        <div>
          <h1 className="font-display text-4xl text-black">MoneyFlow</h1>
          <p className="mt-2 text-black/60">
            Личный учёт денег через Telegram и AI
          </p>
        </div>
        {telegramAuthUrl && (
          <Button
            className="w-full"
            disabled={telegramAuthMutation.isPending}
            onClick={() => {
              window.location.assign(telegramAuthUrl);
            }}
          >
            Войти через Telegram
          </Button>
        )}
        {!botId && (
          <div className="space-y-3">
            <p className="text-sm text-black/60">
              Dev-вход (без Telegram widget). Для production задай
              VITE_TELEGRAM_BOT_ID.
            </p>
            <Button
              className="w-full"
              disabled={devLoginMutation.isPending}
              onClick={async () => {
                try {
                  await devLoginMutation.mutateAsync();
                  await refresh();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Ошибка");
                }
              }}
            >
              Войти (dev)
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </GlassCard>
    </div>
  );
}
