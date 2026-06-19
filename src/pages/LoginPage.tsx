import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { queryKeys } from '@/hooks/queryKeys';
import { AuthCard, authStyles } from '@/components/auth/AuthCard';

/**
 * MVP login form. Plain styling on purpose, visuals come later. On success
 * it seeds the currentUser cache and navigates back to wherever the guard
 * bounced the user from (or `/`).
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
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('credentials')) {
        setError('Feil e-post eller passord.');
      } else if (msg.toLowerCase().includes('rate') || msg.toLowerCase().includes('too many')) {
        setError('For mange forsøk. Vent litt og prøv igjen.');
      } else {
        setError(msg || 'Noe gikk galt. Prøv igjen.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="Logg inn">
      <form onSubmit={onSubmit} style={authStyles.form}>
        <label style={authStyles.label}>
          E-post
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={authStyles.input}
          />
        </label>
        <label style={authStyles.label}>
          Passord
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={authStyles.input}
          />
        </label>
        {error && <p style={authStyles.error}>{error}</p>}
        <button type="submit" disabled={submitting} style={authStyles.button}>
          {submitting ? 'Logger inn…' : 'Logg inn'}
        </button>
      </form>
      <p style={authStyles.footer}>
        Har du ikke konto? <Link to="/signup" style={authStyles.link}>Registrer deg</Link>
      </p>
    </AuthCard>
  );
}
