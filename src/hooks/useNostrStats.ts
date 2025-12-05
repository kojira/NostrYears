import { useState, useCallback } from 'react';
import type { NostrYearsStats, FetchProgress } from '../types/nostr';
import { fetchNostrYearsStats, shutdownFetcher } from '../services/nostrFetcher';

interface UseNostrStatsReturn {
  stats: NostrYearsStats | null;
  isLoading: boolean;
  progress: FetchProgress | null;
  error: string | null;
  fetchStats: (pubkey: string) => Promise<void>;
  reset: () => void;
}

export function useNostrStats(): UseNostrStatsReturn {
  const [stats, setStats] = useState<NostrYearsStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (pubkey: string) => {
    setIsLoading(true);
    setError(null);
    setProgress({ phase: 'idle', message: '準備中...', progress: 0 });

    try {
      const fetchedStats = await fetchNostrYearsStats(pubkey, undefined, setProgress);
      setStats(fetchedStats);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : '統計の取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setStats(null);
    setProgress(null);
    setError(null);
    shutdownFetcher();
  }, []);

  return {
    stats,
    isLoading,
    progress,
    error,
    fetchStats,
    reset,
  };
}

