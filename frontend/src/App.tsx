import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { isNetworkError } from '@/api/client'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/hooks/use-auth.ts'
import { SyncStatusProvider } from '@/hooks/use-sync-status.ts'
import { ProtectedRoute, GuestRoute } from '@/components/layout/protected-route'
import { AppLayout } from '@/components/layout/app-layout'
import LoginPage from '@/pages/login'
import RegisterPage from '@/pages/register'
import DashboardPage from '@/pages/dashboard'
import TransactionsPage from '@/pages/transactions'
import TransactionFormPage from '@/pages/transaction-form'
import AccountsPage from '@/pages/accounts'
import ReportsPage from '@/pages/reports'
import ImportPage from '@/pages/import'
import ImportFullPage from '@/pages/import-full'
import SettingsPage from '@/pages/settings'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      networkMode: 'always',
      retry: (failureCount, error) => {
        if (isNetworkError(error)) return false
        return failureCount < 3
      },
    },
    mutations: {
      networkMode: 'always',
    },
  },
})

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SyncStatusProvider>
            <BrowserRouter
              basename={import.meta.env.BASE_URL.replace(/\/$/, '')}
            >
              <Routes>
                <Route
                  path="/login"
                  element={
                    <GuestRoute>
                      <LoginPage />
                    </GuestRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <GuestRoute>
                      <RegisterPage />
                    </GuestRoute>
                  }
                />
                <Route element={<ProtectedLayout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<DashboardPage />} />
                  <Route path="transactions" element={<TransactionsPage />} />
                  <Route
                    path="transactions/new"
                    element={<TransactionFormPage />}
                  />
                  <Route
                    path="transactions/:id"
                    element={<TransactionFormPage />}
                  />
                  <Route path="accounts" element={<AccountsPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="import/account" element={<ImportPage />} />
                  <Route path="import/full" element={<ImportFullPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </BrowserRouter>
            <Toaster />
          </SyncStatusProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
