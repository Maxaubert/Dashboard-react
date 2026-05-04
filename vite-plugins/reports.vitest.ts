import { describe, it, expect } from 'vitest';
import { __test } from './reports';

const { parsePayload, renderEntry, fileHeader, stripControl, sanitize } = __test;

describe('reports plugin — parsePayload', () => {
  it('accepts a valid bug payload', () => {
    const out = parsePayload(
      JSON.stringify({ type: 'bug', title: 'broken', body: 'detail', page: '/todo' })
    );
    expect(out).toEqual({
      type: 'bug',
      title: 'broken',
      body: 'detail',
      page: '/todo',
    });
  });

  it('accepts a feature payload with no page', () => {
    const out = parsePayload(
      JSON.stringify({ type: 'feature', title: 'add dark toggle', body: '' })
    );
    expect(out).toEqual({
      type: 'feature',
      title: 'add dark toggle',
      body: '',
      page: undefined,
    });
  });

  it('rejects unknown types', () => {
    expect(parsePayload(JSON.stringify({ type: 'spam', title: 'x', body: '' }))).toBeNull();
  });

  it('rejects empty/missing title', () => {
    expect(parsePayload(JSON.stringify({ type: 'bug', title: '   ', body: '' }))).toBeNull();
    expect(parsePayload(JSON.stringify({ type: 'bug', body: '' }))).toBeNull();
  });

  it('rejects malformed JSON', () => {
    expect(parsePayload('not json')).toBeNull();
    expect(parsePayload('null')).toBeNull();
  });

  it('truncates over-long fields', () => {
    const long = 'x'.repeat(10_000);
    const out = parsePayload(JSON.stringify({ type: 'bug', title: long, body: long }));
    expect(out?.title.length).toBe(200);
    expect(out?.body.length).toBe(8000);
  });
});

describe('reports plugin — sanitize', () => {
  it('strips control characters but preserves whitespace', () => {
    expect(stripControl('hello\x00world')).toBe('helloworld');
    expect(stripControl('line\ttab\nnewline')).toBe('line\ttab\nnewline');
    expect(stripControl('bell\x07char')).toBe('bellchar');
    expect(stripControl('del\x7Fchar')).toBe('delchar');
  });

  it('preserves regular spaces', () => {
    expect(sanitize('hello world  ')).toBe('hello world');
  });

  it('returns empty string for non-strings', () => {
    expect(sanitize(undefined)).toBe('');
    expect(sanitize(123)).toBe('');
    expect(sanitize(null)).toBe('');
    expect(sanitize({ x: 1 })).toBe('');
  });
});

describe('reports plugin — renderEntry', () => {
  it('renders a bug entry with page and body', () => {
    const out = renderEntry({
      type: 'bug',
      title: 'Broken thing',
      body: 'It does not work.',
      page: '/todo',
    });
    expect(out).toContain('---');
    expect(out).toMatch(/### \d{4}-\d{2}-\d{2} \d{2}:\d{2} — Broken thing/);
    expect(out).toContain('- **page**: `/todo`');
    expect(out).toContain('- **status**: open');
    expect(out).toContain('It does not work.');
  });

  it('omits the body block when body is empty', () => {
    const out = renderEntry({
      type: 'feature',
      title: 'idea',
      body: '',
    });
    // body block is two blank lines + body + newline; ensure no trailing
    // body section is rendered when body is empty.
    expect(out.endsWith('\n')).toBe(true);
    expect(out).not.toContain('\n\n\n\n');
  });

  it('omits the page line when page is missing', () => {
    const out = renderEntry({ type: 'feature', title: 'x', body: 'y' });
    expect(out).not.toContain('**page**');
    expect(out).toContain('**status**: open');
  });
});

describe('reports plugin — fileHeader', () => {
  it('uses the bug heading for bug type', () => {
    expect(fileHeader('bug')).toContain('# Bug reports');
  });

  it('uses the feature heading for feature type', () => {
    expect(fileHeader('feature')).toContain('# Feature requests');
  });
});
