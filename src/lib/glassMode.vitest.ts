// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  applyGlassModeClass,
  GLASS_MODE_CLASS,
  GLASS_MODE_DEFAULT,
} from './glassMode';

describe('glassMode', () => {
  beforeEach(() => {
    document.body.className = '';
  });

  it('defaults to off', () => {
    expect(GLASS_MODE_DEFAULT).toBe(false);
  });

  it('adds the body class when enabled', () => {
    applyGlassModeClass(true);
    expect(document.body.classList.contains(GLASS_MODE_CLASS)).toBe(true);
  });

  it('removes the body class when disabled', () => {
    document.body.classList.add(GLASS_MODE_CLASS);
    applyGlassModeClass(false);
    expect(document.body.classList.contains(GLASS_MODE_CLASS)).toBe(false);
  });
});
