import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { ApiError } from '@/api/client';
import { queryKeys } from '@/hooks/queryKeys';
import { AuthCard, authStyles } from '@/components/auth/AuthCard';

/**
 * MVP signup form. Requires an invite code (the backend enforces it).
 * On success the user is logged in immediately (server sets the cookie)
 * and routed to `/`.
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
    <AuthCard title="Registrer deg">
      <form onSubmit={onSubmit} style={authStyles.form}>
        <label style={authStyles.label}>
          Invitasjonskode
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={authStyles.input}
          />
        </label>
        <label style={authStyles.label}>
          Visningsnavn
          <input
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={authStyles.input}
          />
        </label>
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
          Passord (minst 10 tegn)
          <input
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={authStyles.input}
          />
        </label>
        {error && <p style={authStyles.error}>{error}</p>}
        <button type="submit" disabled={submitting} style={authStyles.button}>
          {submitting ? 'Registrerer…' : 'Registrer deg'}
        </button>
      </form>
      <p style={authStyles.footer}>
        Har du allerede konto? <Link to="/login" style={authStyles.link}>Logg inn</Link>
      </p>
    </AuthCard>
  );
}
