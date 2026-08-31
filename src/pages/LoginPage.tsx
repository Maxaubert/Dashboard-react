import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { mapAuthError } from '@/lib/authErrors';
import { queryKeys } from '@/hooks/queryKeys';
import { AuthCard } from '@/components/auth/AuthCard';

/**
 * Minimalist login: brand + two placeholder fields + button on a blurred
 * galaxy video background. On success it seeds the currentUser cache and
 * navigates back to wherever the guard bounced from (or `/`). Supabase error
 * strings are mapped to Norwegian in `lib/authErrors`.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await authApi.login(email.trim(), password);
      qc.setQueryData(queryKeys.currentUser, user);
      navigate(from, { replace: true });
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <form onSubmit={onSubmit} style={{ display: 'contents' }}>
        <input
          className="auth-input"
          type="email"
          placeholder="E-post"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="auth-input"
          type="password"
          placeholder="Passord"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-btn" type="submit" disabled={submitting}>
          {submitting ? 'Logger inn…' : 'Logg inn'}
        </button>
      </form>
      {/* Public signup is disabled in Supabase after the single account was
          created (see the 2026-06-19 migration spec); /signup stays routable
          but is not advertised here. */}
    </AuthCard>
  );
}
