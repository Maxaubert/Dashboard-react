import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { useAuthSync } from './hooks/useCurrentUser';
import { AppShell } from './components/layout/AppShell';
import { ToastProvider } from './components/ui';
import { ReportProvider } from './components/report/ReportProvider';
import { RequireAuth } from './components/auth/RequireAuth';
import { TimerProvider } from '@/context/TimerContext';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { HomePage } from './pages/HomePage';
import { PlanPage } from './pages/PlanPage';
import { TodoPage } from './pages/TodoPage';
import { SkolePage } from './pages/SkolePage';
import { NotesPage } from './pages/NotesPage';
import { SportPage } from './pages/SportPage';
import { GamingPage } from './pages/GamingPage';
import { LinksPage } from './pages/LinksPage';
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
        <TimerProvider>
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
                    <ReportProvider>
                      <AppShell>
                        <Outlet />
                      </AppShell>
                    </ReportProvider>
                  </RequireAuth>
                }
              >
                <Route path="/" element={<HomePage />} />
                <Route path="/plan" element={<PlanPage />} />
                <Route path="/todo" element={<TodoPage />} />
                <Route path="/skole" element={<SkolePage />} />
                <Route path="/notes" element={<NotesPage />} />
                <Route path="/sport" element={<SportPage />} />
                <Route path="/gaming" element={<GamingPage />} />
                <Route path="/links" element={<LinksPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TimerProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
