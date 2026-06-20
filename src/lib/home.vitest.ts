import { describe, it, expect } from 'vitest';
import { SECTION_IDS, SECTION_LABELS } from './home';

describe('SECTION_LABELS', () => {
  it('has a non-empty label for every section id', () => {
    for (const id of SECTION_IDS) {
      expect(SECTION_LABELS[id]).toBeTruthy();
    }
  });

  it('has no labels for unknown ids beyond SECTION_IDS', () => {
    expect(Object.keys(SECTION_LABELS).sort()).toEqual([...SECTION_IDS].sort());
  });
});
