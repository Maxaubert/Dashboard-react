import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchLocation } from './weather';

function mockFetch(body: unknown, ok = true) {
  const fn = vi.fn(async (_input: string) => ({ ok, json: async () => body }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('searchLocation', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns null for a blank query without calling the network', async () => {
    const fetch = mockFetch({});
    expect(await searchLocation('   ')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('queries the Open-Meteo geocoder for the trimmed name in Norwegian', async () => {
    const fetch = mockFetch({ results: [] });
    await searchLocation('  Bergen ');
    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.origin + url.pathname).toBe('https://geocoding-api.open-meteo.com/v1/search');
    expect(url.searchParams.get('name')).toBe('Bergen');
    expect(url.searchParams.get('count')).toBe('1');
    expect(url.searchParams.get('language')).toBe('no');
  });

  it('maps the top hit to a GeoLocation', async () => {
    mockFetch({
      results: [
        { latitude: 60.39, longitude: 5.32, name: 'Bergen', country: 'Norge', admin1: 'Vestland', extra: 1 },
        { latitude: 0, longitude: 0, name: 'Other' },
      ],
    });
    expect(await searchLocation('Bergen')).toEqual({
      latitude: 60.39,
      longitude: 5.32,
      name: 'Bergen',
      country: 'Norge',
      admin1: 'Vestland',
    });
  });

  it('returns null when there are no results or the response is not ok', async () => {
    mockFetch({});
    expect(await searchLocation('Xyzzy')).toBeNull();
    mockFetch({ results: [{ name: 'ignored' }] }, false);
    expect(await searchLocation('Bergen')).toBeNull();
  });
});
