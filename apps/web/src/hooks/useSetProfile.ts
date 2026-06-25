'use client';

import { useState } from 'react';
import { setProfile, SetProfileParams } from '@/lib/contracts/profile';

export function useSetProfile() {
  const [loading, setLoading] = useState(false);

  async function mutate(params: SetProfileParams) {
    setLoading(true);

    try {
      return await setProfile(params);
    } finally {
      setLoading(false);
    }
  }

  return {
    mutate,
    loading,
  };
}