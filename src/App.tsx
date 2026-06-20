import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { useAuthSync } from './hooks/useCurrentUser';
import { AppShell } from './components/layout/AppShell';
import { ToastProvider } from './components/ui';
import { RequireAuth } from './components/auth/RequireAuth';
import { PageOverlayProvider } from '@/context/PageOverlayContext';
import { PageOverlay } from '@/components/overlay/PageOverlay';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

function AuthSync() { useAuthSync(); return null; }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Per-hook staleTime overrides this default.
      staleTime: 60_000,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AuthSync />
          <Routes>
            {/* Public auth routes — no sidebar, no guard. */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Everything else lives behind the session guard. */}
            <Route
              element={
                <RequireAuth>
                  <PageOverlayProvider>
                    <AppShell>
                      <Outlet />
                    </AppShell>
                    <PageOverlay />
                  </PageOverlayProvider>
                </RequireAuth>
              }
            >
              <Route path="/" element={<HomePage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
