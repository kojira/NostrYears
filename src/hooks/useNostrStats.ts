import { useState, useCallback, useRef } from 'react';
import type { NostrYearsStats, FetchProgress, NostrYearsEventContent, NostrProfile } from '../types/nostr';
import { fetchNostrYearsStats, shutdownFetcher, fetchProfile, DEFAULT_RELAYS } from '../services/nostrFetcher';
import { fetchOwnNostrYearsEventWithRelays } from '../services/nostrPublisher';

interface UseNostrStatsReturn {
  stats: NostrYearsStats | null;
  isLoading: boolean;
  progress: FetchProgress | null;
  error: string | null;
  isFromCache: boolean;
  fetchStats: (pubkey: string, relays: string[], periodSince: number, periodUntil: number, force?: boolean) => Promise<void>;
  setCachedStats: (pubkey: string, content: NostrYearsEventContent, profile: NostrProfile | null) => void;
  reset: () => void;
}

export function useNostrStats(): UseNostrStatsReturn {
  const [stats, setStats] = useState<NostrYearsStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const skipCacheRef = useRef(false);

  const fetchStats = useCallback(async (
    pubkey: string, 
    relays: string[], 
    periodSince: number, 
    periodUntil: number,
    force?: boolean
  ) => {
    setIsLoading(true);
    setError(null);
    setIsFromCache(false);
    setProgress({ phase: 'idle', message: 'Checking for existing results...', progress: 5 });

    const shouldSkipCache = force || skipCacheRef.current;
    skipCacheRef.current = false;

    try {
      // First, check for existing published stats with same relay config (unless forced)
      let existingStats = null;
      if (!shouldSkipCache) {
        existingStats = await fetchOwnNostrYearsEventWithRelays(pubkey, relays);
        // Also check if the period matches
        if (existingStats && 
            (existingStats.period.since !== periodSince || existingStats.period.until !== periodUntil)) {
          existingStats = null;
        }
      }
      
      if (existingStats) {
        // Found existing stats, fetch profile and use cached data
        setProgress({ phase: 'fetching_own', message: 'Fetching profile...', progress: 50 });
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
          receivedReactionsCount: existingStats.receivedReactionsCount || 0,
          kind42Count: existingStats.kind42Count,
          imageCount: existingStats.imageCount,
          topPosts: existingStats.topPosts || [],
          topReactionEmojis: existingStats.topReactionEmojis || [],
          friendsRanking: [], // Not stored in published event
          monthlyActivity: existingStats.monthlyActivity || [],
          zapsReceived: existingStats.zapsReceived || { count: 0, totalSats: 0, averageSats: 0 },
          zapsSent: existingStats.zapsSent || { count: 0, totalSats: 0, averageSats: 0 },
        };
        
        setProgress({ phase: 'done', message: 'Using cached results', progress: 100 });
        setStats(cachedStats);
        setIsFromCache(true);
      } else {
        // No existing stats or forced refresh, fetch fresh
        setProgress({ phase: 'fetching_own', message: 'Fetching profile...', progress: 5 });
        const fetchedStats = await fetchNostrYearsStats(pubkey, relays, periodSince, periodUntil, setProgress);
        setStats(fetchedStats);
        setIsFromCache(false);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setCachedStats = useCallback((
    pubkey: string,
    content: NostrYearsEventContent,
    profile: NostrProfile | null
  ) => {
    const cachedStats: NostrYearsStats = {
      pubkey,
      profile,
      relays: content.relays || DEFAULT_RELAYS,
      period: content.period,
      kind1Count: content.kind1Count,
      kind1Chars: content.kind1Chars,
      kind30023Count: content.kind30023Count,
      kind30023Chars: content.kind30023Chars,
      kind6Count: content.kind6Count,
      kind7Count: content.kind7Count,
      receivedReactionsCount: content.receivedReactionsCount || 0,
      kind42Count: content.kind42Count,
      imageCount: content.imageCount,
      topPosts: content.topPosts || [],
      topReactionEmojis: content.topReactionEmojis || [],
      friendsRanking: [], // Not stored in published event
      monthlyActivity: content.monthlyActivity || [],
      zapsReceived: content.zapsReceived || { count: 0, totalSats: 0, averageSats: 0 },
      zapsSent: content.zapsSent || { count: 0, totalSats: 0, averageSats: 0 },
    };
    
    setStats(cachedStats);
    setIsFromCache(true);
    setError(null);
    setProgress(null);
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
    setCachedStats,
    reset,
  };
}
