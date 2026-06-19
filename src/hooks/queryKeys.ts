/**
 * Centralized query key registry. Keep keys here so cache invalidation
 * across files always uses the same shape.
 */
export const queryKeys = {
  currentUser: ['currentUser'] as const,
  todos: ['todos'] as const,
  plan: ['plan'] as const,
  links: ['links'] as const,
  notes: ['notes'] as const,
  wishlist: ['wishlist'] as const,
  news: (source: string, count: number) => ['news', source, count] as const,
  home: ['home'] as const,
};
