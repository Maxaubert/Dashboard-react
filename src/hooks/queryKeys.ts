/**
 * Centralized query key registry. Keep keys here so cache invalidation
 * across files always uses the same shape.
 */
export const queryKeys = {
  currentUser: ['currentUser'] as const,
  todos: ['todos'] as const,
  plan: ['plan'] as const,
  links: ['links'] as const,
  wishlist: ['wishlist'] as const,
  steamConnection: ['steam-connection'] as const,
  news: (source: string, count: number) => ['news', source, count] as const,
  weather: (latitude: number, longitude: number) => ['weather', latitude, longitude] as const,
  home: ['home'] as const,
};
