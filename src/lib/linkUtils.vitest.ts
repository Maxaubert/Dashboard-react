import { describe, it, expect } from 'vitest';
import { getDomain, normalizeUrl } from './linkUtils';

describe('normalizeUrl', () => {
  it('prepends https:// when the scheme is missing', () => {
    expect(normalizeUrl('youtube.com')).toBe('https://youtube.com');
    expect(normalizeUrl('  nrk.no/nyheter?x=1  ')).toBe('https://nrk.no/nyheter?x=1');
  });

  it('keeps an explicit scheme untouched', () => {
    expect(normalizeUrl('http://example.com/a')).toBe('http://example.com/a');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com');
    expect(normalizeUrl('steam://run/440')).toBe('steam://run/440');
    expect(normalizeUrl('mailto:max@example.com')).toBe('mailto:max@example.com');
  });

  it('treats host:port as scheme-less', () => {
    expect(normalizeUrl('localhost:5173')).toBe('https://localhost:5173');
    expect(normalizeUrl('localhost:5173/app')).toBe('https://localhost:5173/app');
  });

  it('returns null for empty or invalid input', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('   ')).toBeNull();
    expect(normalizeUrl('not a url')).toBeNull();
    expect(normalizeUrl('https://')).toBeNull();
  });
});

describe('getDomain', () => {
  it('extracts the hostname from a normalised URL', () => {
    expect(getDomain('https://www.youtube.com/watch?v=1')).toBe('www.youtube.com');
    expect(getDomain(normalizeUrl('youtube.com') ?? '')).toBe('youtube.com');
  });

  it('returns null for a scheme-less string', () => {
    expect(getDomain('youtube.com')).toBeNull();
    expect(getDomain('')).toBeNull();
  });
});
