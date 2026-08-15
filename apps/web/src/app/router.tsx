import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getAccessKey } from "@/shared/lib/access-key";
import { AppShell } from "@/widgets/layout/app-shell";
import { RequireAuth } from "@/features/auth/ui/require-auth";
import { CategoriesPage } from "@/pages/categories";
import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import { SettingsPage } from "@/pages/settings";
import { TransactionsPage } from "@/pages/transactions";

export function AppRouter() {
  const basename = `/k/${getAccessKey()}`;

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
