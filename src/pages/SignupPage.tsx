import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { authApi } from '@/api/auth';
import { mapAuthError } from '@/lib/authErrors';
import { queryKeys } from '@/hooks/queryKeys';
import { AuthCard } from '@/components/auth/AuthCard';

/**
 * Signup shares the login shell (galaxy video + glass card). If Supabase
 * returns a session the user is logged in immediately and routed to `/`.
 * With e-mail confirmation on (the hosted default) there is no session yet,
 * so we stay here and tell the user to check their inbox.
 */
export function SignupPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 10) {
      setError('Passordet må være minst 10 tegn.');
      return;
    }
    setSubmitting(true);
    try {
      const { user, session } = await authApi.signup({
        email: email.trim(),
        password,
        display_name: displayName.trim(),
      });
      if (!session) {
        setPassword('');
        setInfo('Sjekk e-posten din for å bekrefte kontoen.');
        return;
      }
      qc.setQueryData(queryKeys.currentUser, user);
      navigate('/', { replace: true });
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
        {info && (
          <p className="auth-info" role="status">
            {info}
          </p>
        )}
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
