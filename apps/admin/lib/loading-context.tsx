'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  progress: number;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const pendingRequests = useRef(0);
  const progressInterval = useRef<NodeJS.Timeout>();

  const startLoading = useCallback(() => {
    pendingRequests.current++;
    if (!isLoading) {
      setIsLoading(true);
      setProgress(10);

      // Gradually increase progress while loading
      if (progressInterval.current) clearInterval(progressInterval.current);
      progressInterval.current = setInterval(() => {
        setProgress(prev => {
          const next = prev + Math.random() * 30;
          return next > 90 ? 90 : next;
        });
      }, 300);
    }
  }, [isLoading]);

  const stopLoading = useCallback(() => {
    pendingRequests.current--;
    if (pendingRequests.current <= 0) {
      pendingRequests.current = 0;
      setProgress(100);
      if (progressInterval.current) clearInterval(progressInterval.current);

      setTimeout(() => {
        setIsLoading(false);
        setProgress(0);
      }, 300);
    }
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  return (
    <LoadingContext.Provider value={{ isLoading, startLoading, stopLoading, progress }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
}
