import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
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
import { ToolsPage } from './pages/ToolsPage';
import { ToolQrPage } from './pages/tools/ToolQrPage';
import { ToolCalculatorPage } from './pages/tools/ToolCalculatorPage';
import { ToolTimerPage } from './pages/tools/ToolTimerPage';
import { ToolReaderPage } from './pages/tools/ToolReaderPage';
import { ToolVideoDownloadPage } from './pages/tools/ToolVideoDownloadPage';
import { ToolBgRemovePage } from './pages/tools/ToolBgRemovePage';
import { ToolPdfPage } from './pages/tools/ToolPdfPage';
import { ToolConvertPage } from './pages/tools/ToolConvertPage';
import { NotFoundPage } from './pages/NotFoundPage';

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
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/tools/qr" element={<ToolQrPage />} />
                <Route path="/tools/calculator" element={<ToolCalculatorPage />} />
                <Route path="/tools/timer" element={<ToolTimerPage />} />
                <Route path="/tools/reader" element={<ToolReaderPage />} />
                <Route path="/tools/video" element={<ToolVideoDownloadPage />} />
                <Route path="/tools/bgremove" element={<ToolBgRemovePage />} />
                <Route path="/tools/pdf" element={<ToolPdfPage />} />
                <Route path="/tools/convert" element={<ToolConvertPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </TimerProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
