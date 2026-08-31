import { describe, it, expect } from 'vitest';
import { readSteamCallback, stripSteamParam } from './steamCallback';

describe('readSteamCallback', () => {
  it('returns connected / error for the known values', () => {
    expect(readSteamCallback('?steam=connected')).toBe('connected');
    expect(readSteamCallback('?steam=error')).toBe('error');
  });
  it('returns null when the param is missing or unknown', () => {
    expect(readSteamCallback('')).toBeNull();
    expect(readSteamCallback('?foo=bar')).toBeNull();
    expect(readSteamCallback('?steam=whatever')).toBeNull();
  });
});

describe('stripSteamParam', () => {
  it('drops the steam param and keeps the path', () => {
    expect(stripSteamParam('/', '?steam=connected')).toBe('/');
  });
  it('preserves other query params', () => {
    expect(stripSteamParam('/', '?a=1&steam=error&b=2')).toBe('/?a=1&b=2');
  });
  it('is a no-op without the param', () => {
    expect(stripSteamParam('/', '')).toBe('/');
    expect(stripSteamParam('/', '?a=1')).toBe('/?a=1');
  });
});
