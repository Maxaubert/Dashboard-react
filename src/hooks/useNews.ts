import { useQuery } from '@tanstack/react-query';
import { newsApi, type NewsSource } from '@/api/news';
import { queryKeys } from './queryKeys';

export function useNews(source: NewsSource = 'vg', count = 14) {
  return useQuery({
    queryKey: queryKeys.news(source, count),
    queryFn: () => newsApi.list(source, count),
    staleTime: 5 * 60_000,
  });
}
