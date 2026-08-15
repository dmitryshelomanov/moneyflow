import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/features/auth/model/auth-context";

export function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-black/55">
        Загрузка…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
