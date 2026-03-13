'use client';

import { useLoading } from '@/lib/loading-context';

export function ProgressBar() {
  const { isLoading, progress } = useLoading();

  return (
    <div className="fixed top-0 left-0 right-0 h-1 z-[9999]">
      {isLoading && (
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300 ease-out shadow-lg"
          style={{
            width: `${progress}%`,
          }}
        />
      )}
    </div>
  );
}
