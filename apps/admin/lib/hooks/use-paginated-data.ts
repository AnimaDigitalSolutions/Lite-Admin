'use client';

import { useState, useCallback, useEffect } from 'react';

interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    total?: number;
    limit?: number;
    offset?: number;
  };
}

interface UsePaginatedDataOptions {
  pageSize?: number;
  immediate?: boolean;
}

interface UsePaginatedDataReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
}

export function usePaginatedData<T>(
  fetcher: (limit: number, offset: number) => Promise<PaginatedResponse<T>>,
  deps: React.DependencyList = [],
  options: UsePaginatedDataOptions = {},
): UsePaginatedDataReturn<T> {
  const { pageSize = 20, immediate = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const offset = (currentPage - 1) * pageSize;
      const response = await fetcher(pageSize, offset);
      setData(response.data || []);
      if (response.pagination?.total != null) {
        setTotalPages(Math.ceil(response.pagination.total / pageSize) || 1);
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setError(e.response?.data?.error?.message ?? e.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, ...deps]);

  useEffect(() => {
    if (immediate) {
      void refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch]);

  return { data, loading, error, currentPage, totalPages, setCurrentPage, refetch, setData };
}
