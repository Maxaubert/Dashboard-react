// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { ENGINES, buildPromptUrl, type EngineId } from './engines';

describe('ENGINES registry', () => {
  it('lists the four supported engines in dropdown order', () => {
    expect(ENGINES.map((e) => e.id)).toEqual(['claude', 'chatgpt', 'perplexity', 'google']);
  });

  it('marks Claude as the only one that needs a userscript', () => {
    const needs = ENGINES.filter((e) => e.needsUserscript).map((e) => e.id);
    expect(needs).toEqual(['claude']);
  });
});

describe('buildPromptUrl', () => {
  const cases: Array<[EngineId, string, string]> = [
    ['claude', 'hello', 'https://claude.ai/new?q=hello'],
    ['chatgpt', 'hello', 'https://chatgpt.com/?q=hello&hints=search'],
    ['perplexity', 'hello', 'https://www.perplexity.ai/search?q=hello'],
    ['google', 'hello', 'https://www.google.com/search?q=hello'],
  ];

  it.each(cases)('builds correct URL for %s', (id, q, expected) => {
    expect(buildPromptUrl(id, q)).toBe(expected);
  });

  it('URL-encodes spaces', () => {
    expect(buildPromptUrl('google', 'two words')).toBe(
      'https://www.google.com/search?q=two%20words'
    );
  });

  it('URL-encodes reserved characters and unicode', () => {
    expect(buildPromptUrl('perplexity', 'a & b ? # é')).toBe(
      'https://www.perplexity.ai/search?q=a%20%26%20b%20%3F%20%23%20%C3%A9'
    );
  });

  it('preserves ChatGPT hints=search suffix even with a complex query', () => {
    const url = buildPromptUrl('chatgpt', 'why & when');
    expect(url.startsWith('https://chatgpt.com/?q=')).toBe(true);
    expect(url.endsWith('&hints=search')).toBe(true);
  });

  it('returns an empty q= for the empty string (guard lives in the component)', () => {
    expect(buildPromptUrl('google', '')).toBe('https://www.google.com/search?q=');
  });
});
