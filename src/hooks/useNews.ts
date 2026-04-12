import { useQuery } from '@tanstack/react-query';
import { newsApi, type NewsSource } from '@/api/news';

export function useNews(source: NewsSource = 'vg', count = 14) {
  return useQuery({
    queryKey: ['news', source, count],
    queryFn: () => newsApi.list(source, count),
    staleTime: 5 * 60_000,
  });
}
