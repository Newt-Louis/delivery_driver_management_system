import { useCallback, useState } from 'react';

const BATCH_SIZE = 40;

export function useProgressiveRows(total: number) {
  const [limit, setLimit] = useState(BATCH_SIZE);
  const hasMore = limit < total;
  const loadMore = useCallback(() => setLimit(current => current + BATCH_SIZE), []);
  const reset = useCallback(() => setLimit(BATCH_SIZE), []);
  return { limit, hasMore, loadMore, reset };
}
