import type { CSSProperties, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const screenStyle: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  alignItems: 'center',
  justifyContent: 'center',
  background: '#050505',
  color: '#71717a',
  fontSize: '0.9rem',
};

const retryStyle: CSSProperties = {
  background: 'transparent',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  color: '#e4e4e7',
  padding: '6px 14px',
  fontSize: '0.85rem',
  cursor: 'pointer',
};

/**
 * Route guard on top of the persisted Supabase session (`authApi.me`).
 * While the session probe is in flight we render a quiet placeholder
 * (avoids a flash of the app before bouncing). If the probe fails for a
 * non-auth reason (offline, refresh endpoint down) we keep the user where
 * they are and offer a retry instead of redirecting; only a confirmed
 * "no session" sends them to /login, preserving where they came from so
 * login can send them back.
 *
 * Known limitation: auth-js caches a failed token refresh for 60 s
 * (`REFRESH_FAILURE_COOLDOWN_MS`), so "Prøv igjen" within a minute of the
 * failure re-throws the cached error without touching the network. After
 * the cooldown the client's auto-refresh tick recovers on its own and
 * TOKEN_REFRESHED seeds the cache through `useAuthSync`, so the screen
 * clears without a click.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading, isError, isFetching, refetch } = useCurrentUser();
  const location = useLocation();

  if (user) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <div style={screenStyle}>Laster…</div>;
  }

  if (isError) {
    return (
      <div style={screenStyle} role="alert">
        <span>Fikk ikke sjekket innloggingen. Er du frakoblet?</span>
        <button
          type="button"
          style={retryStyle}
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? 'Prøver…' : 'Prøv igjen'}
        </button>
      </div>
    );
  }

  return <Navigate to="/login" state={{ from: location }} replace />;
}
