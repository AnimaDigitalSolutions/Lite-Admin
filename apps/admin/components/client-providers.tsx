'use client';

import { useEffect } from 'react';
import { LoadingProvider, useLoading } from '@/lib/loading-context';
import { ThemeProvider } from '@/lib/theme-context';
import { setupLoadingInterceptors } from '@/lib/api';
import { ProgressBar } from './progress-bar';

function ClientProvidersInner({ children }: { children: React.ReactNode }) {
  const { startLoading, stopLoading } = useLoading();

  useEffect(() => {
    // Set up axios interceptors with loading context
    setupLoadingInterceptors({
      start: startLoading,
      stop: stopLoading,
    });
  }, [startLoading, stopLoading]);

  return (
    <>
      <ProgressBar />
      {children}
    </>
  );
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <LoadingProvider>
        <ClientProvidersInner>{children}</ClientProvidersInner>
      </LoadingProvider>
    </ThemeProvider>
  );
}
