import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/hooks/queryKeys';
import { AuthCard } from '@/components/auth/AuthCard';

/**
 * Signup shares the login shell (galaxy video + glass card). Placeholder-
 * only fields to match the minimalist login. Requires an invite code (the
 * backend enforces it). On success the user is logged in immediately and
 * routed to `/`.
 */
export function SignupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 10) {
      setError('Passordet må være minst 10 tegn.');
      return;
    }
    setSubmitting(true);
    try {
      const user = await authApi.signup({
        code: code.trim(),
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
      qc.setQueryData(queryKeys.currentUser, user);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Ugyldig eller brukt invitasjonskode.');
      } else if (err instanceof ApiError && err.status === 409) {
        setError('E-posten er allerede registrert.');
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Sjekk at alle felter er fylt ut riktig.');
      } else if (err instanceof ApiError && err.status === 429) {
        setError('For mange forsøk. Vent litt og prøv igjen.');
      } else {
        setError('Noe gikk galt. Prøv igjen.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard>
      <form onSubmit={onSubmit} style={{ display: 'contents' }}>
        <input
          className="auth-input"
          type="text"
          placeholder="Invitasjonskode"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          className="auth-input"
          type="text"
          placeholder="Visningsnavn"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
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
          placeholder="Passord (minst 10 tegn)"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-btn" type="submit" disabled={submitting}>
          {submitting ? 'Registrerer…' : 'Registrer deg'}
        </button>
      </form>
      <p className="auth-footer">
        Har du allerede konto? <Link to="/login">Logg inn</Link>
      </p>
    </AuthCard>
  );
}
