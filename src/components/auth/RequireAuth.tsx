import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/**
 * Route guard. While the /api/auth/me probe is in flight we render
 * nothing (avoids a flash of the app before bouncing). Logged-out users
 * are redirected to /login, preserving where they came from so login can
 * send them back.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#050505',
          color: '#71717a',
          fontSize: '0.9rem',
        }}
      >
        Laster…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
