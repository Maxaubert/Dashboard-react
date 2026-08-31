import { describe, it, expect } from 'vitest';
import { AUTH_ERROR_FALLBACK, mapAuthError } from './authErrors';

describe('mapAuthError', () => {
  it.each([
    ['User already registered', 'E-posten er allerede registrert.'],
    ['Email not confirmed', 'E-posten er ikke bekreftet. Sjekk innboksen din.'],
    ['Signups not allowed for this instance', 'Registrering er stengt.'],
    ['Email signups are disabled', 'Registrering er stengt.'],
    ['Password should be at least 6 characters.', 'Passordet er for svakt. Bruk minst 10 tegn.'],
    ['Unable to validate email address: invalid format', 'Ugyldig e-postadresse.'],
    ['Invalid login credentials', 'Feil e-post eller passord.'],
    ['Email rate limit exceeded', 'For mange forsøk. Vent litt og prøv igjen.'],
    ['Too many requests', 'For mange forsøk. Vent litt og prøv igjen.'],
    ['Failed to fetch', 'Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.'],
  ])('maps "%s"', (input, expected) => {
    expect(mapAuthError(new Error(input))).toBe(expected);
  });

  it('accepts plain strings', () => {
    expect(mapAuthError('Invalid login credentials')).toBe('Feil e-post eller passord.');
  });

  it('falls back to a generic Norwegian message', () => {
    expect(mapAuthError(new Error('Something unexpected'))).toBe(AUTH_ERROR_FALLBACK);
    expect(mapAuthError(new Error(''))).toBe(AUTH_ERROR_FALLBACK);
    expect(mapAuthError(undefined)).toBe(AUTH_ERROR_FALLBACK);
  });
});
