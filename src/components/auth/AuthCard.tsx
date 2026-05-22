import type { CSSProperties, ReactNode } from 'react';

/**
 * Minimal centered card wrapper shared by the login + signup pages.
 * Intentionally plain: this is the MVP shell, a proper visual pass
 * comes later. Styling lives inline here (and in `authStyles`) so it's
 * trivial to rip out and replace with the design-system version.
 */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={authStyles.screen}>
      <div style={authStyles.card}>
        <div style={authStyles.brand}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 3h7v7H3V3m0 11h7v7H3v-7m11-11h7v7h-7V3m0 11h7v7h-7v-7" />
          </svg>
          <span>Dashboard</span>
        </div>
        <h1 style={authStyles.title}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

export const authStyles: Record<string, CSSProperties> = {
  screen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: '#050505',
    color: '#e7e7ea',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    background: '#0b0b0f',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: '32px 28px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#6366f1',
    fontWeight: 700,
    fontSize: '0.95rem',
    marginBottom: 18,
  },
  title: {
    fontSize: '1.4rem',
    fontWeight: 700,
    margin: '0 0 20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: '0.8rem',
    color: '#a1a1aa',
  },
  input: {
    background: '#040406',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '10px 12px',
    color: '#e7e7ea',
    fontSize: '0.95rem',
    outline: 'none',
  },
  button: {
    marginTop: 6,
    background: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '11px 14px',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: '#f87171',
    fontSize: '0.82rem',
    margin: 0,
  },
  footer: {
    marginTop: 20,
    fontSize: '0.82rem',
    color: '#a1a1aa',
    textAlign: 'center',
  },
  link: {
    color: '#818cf8',
    textDecoration: 'none',
  },
};
