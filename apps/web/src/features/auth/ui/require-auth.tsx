import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/model/auth-context";
import { Button } from "@/shared/ui/button";
import { GlassCard } from "@/shared/ui/glass-card";

export function RequireAuth() {
  const { user, loading, sessionError, retrySession } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-black/55">
        Загрузка…
      </div>
    );
  }
  if (!user && sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <GlassCard className="w-full max-w-md space-y-3 text-center">
          <p className="text-sm text-rose-600">{sessionError}</p>
          <Button size="sm" onClick={() => void retrySession()}>
            Повторить
          </Button>
        </GlassCard>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
