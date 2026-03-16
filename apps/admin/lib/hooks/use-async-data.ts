'use client';

import { useState, useCallback, useEffect } from 'react';

interface UseAsyncDataOptions<T> {
  initialData?: T;
  immediate?: boolean;
}

interface UseAsyncDataReturn<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T>>;
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncDataOptions<T> = {},
): UseAsyncDataReturn<T> {
  const { initialData, immediate = true } = options;
  const [data, setData] = useState<T>(initialData as T);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(e.response?.data?.error?.message ?? e.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (immediate) {
      void refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch]);

  return { data, loading, error, refetch, setData };
}
