export const SECTION_IDS = [
  'prompt-launcher',
  'todo',
  'dagens-plan',
  'wishlist',
  'ext-lenker',
  'vaer',
  'nyhetssaker',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];
export const DEFAULT_SECTIONS: SectionId[] = [...SECTION_IDS];

/** Human-readable nb-NO labels for the Settings toggle list. */
export const SECTION_LABELS: Record<SectionId, string> = {
  'prompt-launcher': 'Hurtigsøk',
  'todo': 'Gjøremål',
  'dagens-plan': 'Dagens plan',
  'wishlist': 'Ønskeliste',
  'ext-lenker': 'Eksterne lenker',
  'vaer': 'Vær',
  'nyhetssaker': 'Nyheter',
};

export const DAY_NO = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
export const MON_NO = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'];
