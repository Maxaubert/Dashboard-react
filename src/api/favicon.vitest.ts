import { describe, it, expect } from 'vitest';
import { faviconUrl } from './pdf';

describe('faviconUrl', () => {
  it('points at the Google favicon service', () => {
    expect(faviconUrl('example.com')).toBe('https://www.google.com/s2/favicons?domain=example.com&sz=64');
  });
});
