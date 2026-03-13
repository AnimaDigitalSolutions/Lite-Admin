'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WaitlistRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/subscribers');
  }, [router]);

  return null;
}
