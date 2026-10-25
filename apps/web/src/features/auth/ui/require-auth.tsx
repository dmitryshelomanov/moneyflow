import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/model/auth-context";
import { QueryErrorCard } from "@/shared/ui/query-error-card";

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
        <QueryErrorCard
          className="w-full max-w-md text-center"
          message={sessionError}
          onRetry={() => void retrySession()}
        />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
