import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { sessionApi } from "@/entities/session/api/session-api";
import { useAuth } from "@/features/auth/model/auth-context";
import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

export function LoginPage() {
  const { user, loading, refresh } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const jakeBg = `${import.meta.env.BASE_URL}theme/jake.png`;
  const finnBg = `${import.meta.env.BASE_URL}theme/finn.png`;
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as
    string | undefined;

  const telegramAuthMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      sessionApi.telegramAuth(payload),
  });
  const devLoginMutation = useMutation({
    mutationFn: () => sessionApi.devLogin({ name: "Dev User" }),
  });

  useEffect(() => {
    window.onTelegramAuth = async (payload) => {
      try {
        await telegramAuthMutation.mutateAsync(payload);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка входа");
      }
    };

    if (!botUsername || !widgetRef.current) return;
    widgetRef.current.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "16");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    widgetRef.current.appendChild(script);
  }, [botUsername, refresh, telegramAuthMutation]);

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
        <div ref={widgetRef} className="flex justify-center" />
        {!botUsername && (
          <div className="space-y-3">
            <p className="text-sm text-black/60">
              Dev-вход (без Telegram widget). В production задай
              VITE_TELEGRAM_BOT_USERNAME.
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
