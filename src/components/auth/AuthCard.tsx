import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

/**
 * Shared shell for the login + signup screens: a full-bleed blurred
 * galaxy video background, a dark readability scrim, and a dark
 * frosted-glass card that fades + scales in on mount (framer-motion).
 *
 * The card is a flex column with a uniform gap; children passed in
 * (inputs, button, footer) line up under the brand. Wrap form fields in
 * a `<form style={{ display: 'contents' }}>` so they join this flex flow
 * directly while keeping native submit behavior.
 *
 * Styles live under `.auth-*` in globals.css. The video is the compressed
 * `public/galaxy.mp4` (720p, ~700KB, fine because it's blurred).
 */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen">
      <video className="auth-bg" autoPlay muted loop playsInline>
        <source src="/galaxy.mp4" type="video/mp4" />
      </video>
      <div className="auth-scrim" />
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="auth-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M3 3h7v7H3V3m0 11h7v7H3v-7m11-11h7v7h-7V3m0 11h7v7h-7v-7" />
          </svg>
          <span>Dashboard</span>
        </div>
        {children}
      </motion.div>
    </div>
  );
}
