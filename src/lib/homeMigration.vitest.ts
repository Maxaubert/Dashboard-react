// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  readLocalStorageHome,
  decideMigration,
  clearLocalStorageHome,
  LOCAL_STORAGE_KEYS,
} from './homeMigration';
import type { HomeEnvelope } from '@/api/types';

function emptyEnvelope(): HomeEnvelope {
  return { version: 1, sections: [], hidden: [], widgets: [], habits: [] };
}

describe('readLocalStorageHome', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty envelope when no keys are set', () => {
    expect(readLocalStorageHome()).toEqual(emptyEnvelope());
  });

  it('reads all three keys when present', () => {
    localStorage.setItem('home-section-order', JSON.stringify(['widgets', 'news']));
    localStorage.setItem('home-widgets-v1', JSON.stringify([{ id: 'w1', type: 'alarm', refId: 'alarm' }]));
    localStorage.setItem('home-habits-v1', JSON.stringify([
      { id: 'h1', name: 'Run', color: '#34d399', completedDays: ['2026-04-12'], createdAt: '2026-04-12T00:00:00Z' },
    ]));
    const env = readLocalStorageHome();
    expect(env.sections).toEqual(['widgets', 'news']);
    expect(env.widgets).toHaveLength(1);
    expect(env.habits).toHaveLength(1);
  });

  it('tolerates malformed JSON per key (returns empty for that key only)', () => {
    localStorage.setItem('home-section-order', '{ malformed ]');
    localStorage.setItem('home-widgets-v1', JSON.stringify([{ id: 'w1', type: 'alarm', refId: 'alarm' }]));
    const env = readLocalStorageHome();
    expect(env.sections).toEqual([]);
    expect(env.widgets).toHaveLength(1);
  });
});

describe('decideMigration', () => {
  it('returns shouldMigrate=false when backend is non-empty', () => {
    const backend: HomeEnvelope = {
      version: 1, sections: ['widgets'], hidden: [], widgets: [], habits: [],
    };
    const local: HomeEnvelope = {
      version: 1, sections: [], hidden: [], widgets: [], habits: [],
    };
    expect(decideMigration(backend, local).shouldMigrate).toBe(false);
  });

  it('returns shouldMigrate=false when both backend and local are empty', () => {
    expect(decideMigration(emptyEnvelope(), emptyEnvelope()).shouldMigrate).toBe(false);
  });

  it('returns shouldMigrate=true when backend empty and local has data', () => {
    const local: HomeEnvelope = {
      version: 1,
      sections: ['widgets'],
      hidden: [],
      widgets: [{ id: 'w1', type: 'alarm', refId: 'alarm' }],
      habits: [],
    };
    const result = decideMigration(emptyEnvelope(), local);
    expect(result.shouldMigrate).toBe(true);
    expect(result.next).toEqual(local);
  });
});

describe('clearLocalStorageHome', () => {
  it('removes all three migration keys', () => {
    for (const k of LOCAL_STORAGE_KEYS) localStorage.setItem(k, 'x');
    clearLocalStorageHome();
    for (const k of LOCAL_STORAGE_KEYS) expect(localStorage.getItem(k)).toBeNull();
  });
});
