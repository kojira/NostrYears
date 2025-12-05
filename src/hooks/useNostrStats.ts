import { useState, useCallback, useRef } from 'react';
import type { NostrYearsStats, FetchProgress } from '../types/nostr';
import { fetchNostrYearsStats, shutdownFetcher, fetchProfile } from '../services/nostrFetcher';
import { fetchOwnNostrYearsEventWithRelays } from '../services/nostrPublisher';

interface UseNostrStatsReturn {
  stats: NostrYearsStats | null;
  isLoading: boolean;
  progress: FetchProgress | null;
  error: string | null;
  isFromCache: boolean;
  fetchStats: (pubkey: string, relays: string[], force?: boolean) => Promise<void>;
  reset: () => void;
}

export function useNostrStats(): UseNostrStatsReturn {
  const [stats, setStats] = useState<NostrYearsStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const skipCacheRef = useRef(false);

  const fetchStats = useCallback(async (pubkey: string, relays: string[], force?: boolean) => {
    setIsLoading(true);
    setError(null);
    setIsFromCache(false);
    setProgress({ phase: 'idle', message: '既存の集計結果を確認中...', progress: 5 });

    const shouldSkipCache = force || skipCacheRef.current;
    skipCacheRef.current = false;

    try {
      // First, check for existing published stats with same relay config (unless forced)
      let existingStats = null;
      if (!shouldSkipCache) {
        existingStats = await fetchOwnNostrYearsEventWithRelays(pubkey, relays);
      }
      
      if (existingStats) {
        // Found existing stats, fetch profile and use cached data
        setProgress({ phase: 'fetching_own', message: 'プロフィールを取得中...', progress: 50 });
        const profile = await fetchProfile(pubkey, relays);
        
        const cachedStats: NostrYearsStats = {
          pubkey,
          profile,
          relays,
          period: existingStats.period,
          kind1Count: existingStats.kind1Count,
          kind1Chars: existingStats.kind1Chars,
          kind30023Count: existingStats.kind30023Count,
          kind30023Chars: existingStats.kind30023Chars,
          kind6Count: existingStats.kind6Count,
          kind7Count: existingStats.kind7Count,
          kind42Count: existingStats.kind42Count,
          imageCount: existingStats.imageCount,
          topPostId: existingStats.topPostId,
          topPostReactionCount: existingStats.topPostReactionCount,
          friendsRanking: [], // Not stored in published event
        };
        
        setProgress({ phase: 'done', message: '既存の集計結果を使用', progress: 100 });
        setStats(cachedStats);
        setIsFromCache(true);
      } else {
        // No existing stats or forced refresh, fetch fresh
        setProgress({ phase: 'fetching_own', message: 'プロフィールを取得中...', progress: 5 });
        const fetchedStats = await fetchNostrYearsStats(pubkey, relays, setProgress);
        setStats(fetchedStats);
        setIsFromCache(false);
      }
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
    setIsFromCache(false);
    skipCacheRef.current = true; // Next fetch will skip cache
    shutdownFetcher();
  }, []);

  return {
    stats,
    isLoading,
    progress,
    error,
    isFromCache,
    fetchStats,
    reset,
  };
}
