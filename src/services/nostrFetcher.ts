import { NostrFetcher } from 'nostr-fetch';
import type { NostrEvent } from 'nostr-fetch';
import type { NostrYearsStats, FetchProgress, NostrProfile, TopPostInfo, TopReactionEmoji } from '../types/nostr';
import { countCharsWithoutUrls, countImages, extractPubkeysFromTags, isReply } from '../utils/textAnalysis';
import { calculateFriendScores, addToCountMap } from '../utils/scoring';

// Helper to get month key from timestamp
function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Default relays
export const DEFAULT_RELAYS = ['wss://r.kojira.io', 'wss://yabu.me'];

// Default time range: 2025/1/1 0:00:00 JST to 2025/12/1 0:00:00 JST
// JST = UTC + 9 hours
export const DEFAULT_PERIOD_SINCE = Math.floor(new Date('2024-12-31T15:00:00Z').getTime() / 1000);
export const DEFAULT_PERIOD_UNTIL = Math.floor(new Date('2025-11-30T15:00:00Z').getTime() / 1000);

let fetcher: NostrFetcher | null = null;

/**
 * Initialize the fetcher singleton
 */
export function initFetcher(): NostrFetcher {
  if (!fetcher) {
    fetcher = NostrFetcher.init();
  }
  return fetcher;
}

/**
 * Shutdown the fetcher
 */
export function shutdownFetcher(): void {
  if (fetcher) {
    fetcher.shutdown();
    fetcher = null;
  }
}

/**
 * Fetch user profile (kind 0)
 */
export async function fetchProfile(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<NostrProfile | null> {
  const f = initFetcher();
  
  try {
    const event = await f.fetchLastEvent(relays, {
      kinds: [0],
      authors: [pubkey],
    });
    
    if (event) {
      return JSON.parse(event.content) as NostrProfile;
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
  }
  
  return null;
}

/**
 * Fetch all stats for a user
 */
export async function fetchNostrYearsStats(
  pubkey: string,
  relays: string[] = DEFAULT_RELAYS,
  periodSince: number = DEFAULT_PERIOD_SINCE,
  periodUntil: number = DEFAULT_PERIOD_UNTIL,
  onProgress?: (progress: FetchProgress) => void
): Promise<NostrYearsStats> {
  const f = initFetcher();
  
  // Map to count reaction emojis
  const reactionEmojiCounts = new Map<string, number>();

  // Maps for friend scoring
  const outgoingReactions = new Map<string, number>();
  const outgoingReplies = new Map<string, number>();
  const incomingReactions = new Map<string, number>();
  const incomingReplies = new Map<string, number>();
  
  // Store own kind 1 event IDs for top posts calculation
  const ownKind1Ids = new Set<string>();
  const kind1ReactionCounts = new Map<string, number>();

  // Fetch data - use iterator to show progress based on date
  const periodDuration = periodUntil - periodSince;

  // Helper to iterate events with progress
  async function fetchWithProgress(
    filter: { kinds: number[]; authors?: string[]; '#p'?: string[] },
    phaseLabel: string,
    progressStart: number,
    progressEnd: number
  ): Promise<NostrEvent[]> {
    const events: NostrEvent[] = [];
    let lastProgressUpdate = progressStart;

    const iterator = f.allEventsIterator(
      relays,
      filter,
      { since: periodSince, until: periodUntil }
    );

    for await (const event of iterator) {
      events.push(event);
      
      // Update progress based on event's created_at (events come in reverse chronological order)
      const eventProgress = (periodUntil - event.created_at) / periodDuration;
      const progress = progressStart + eventProgress * (progressEnd - progressStart);
      
      // Throttle updates to avoid too frequent UI updates
      if (progress - lastProgressUpdate >= 2) {
        const percent = Math.round(eventProgress * 100);
        onProgress?.({
          phase: 'fetching_own',
          message: `${phaseLabel} (${percent}%)`,
          progress: Math.min(progress, progressEnd),
        });
        lastProgressUpdate = progress;
      }
    }

    return events;
  }

  // Start profile fetch in background
  const profilePromise = fetchProfile(pubkey, relays);

  // Phase 1: Fetch own events (5% - 40%)
  onProgress?.({
    phase: 'fetching_own',
    message: 'Fetching posts...',
    progress: 5,
  });

  const ownEvents = await fetchWithProgress(
    { kinds: [1, 6, 7, 42, 30023], authors: [pubkey] },
    'Fetching posts...',
    5,
    40
  );

  // Phase 2: Fetch reactions to my posts (40% - 60%)
  onProgress?.({
    phase: 'fetching_reactions',
    message: 'Fetching reactions...',
    progress: 40,
  });

  const incomingReactionsEvents = await fetchWithProgress(
    { kinds: [7], '#p': [pubkey] },
    'Fetching reactions...',
    40,
    60
  );

  // Phase 3: Fetch replies mentioning me (60% - 80%)
  onProgress?.({
    phase: 'fetching_mentions',
    message: 'Fetching replies...',
    progress: 60,
  });

  const mentionEvents = await fetchWithProgress(
    { kinds: [1], '#p': [pubkey] },
    'Fetching replies...',
    60,
    80
  );

  // Wait for profile
  const profile = await profilePromise;

  onProgress?.({
    phase: 'calculating',
    message: 'Processing data...',
    progress: 65,
  });

  // Monthly activity tracking
  const monthlyMap = new Map<string, { kind1: number; kind6: number; kind7: number; kind42: number; kind30023: number; receivedReactions: number }>();

  const stats: NostrYearsStats = {
    pubkey,
    profile,
    relays: [...relays],
    period: { since: periodSince, until: periodUntil },
    kind1Count: 0,
    kind1Chars: 0,
    kind30023Count: 0,
    kind30023Chars: 0,
    kind6Count: 0,
    kind7Count: 0,
    receivedReactionsCount: 0,
    kind42Count: 0,
    imageCount: 0,
    topPosts: [],
    topReactionEmojis: [],
    friendsRanking: [],
    monthlyActivity: [],
  };

  // Helper to increment monthly count
  const addToMonthly = (timestamp: number, kind: 'kind1' | 'kind6' | 'kind7' | 'kind42' | 'kind30023' | 'receivedReactions') => {
    const monthKey = getMonthKey(timestamp);
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { kind1: 0, kind6: 0, kind7: 0, kind42: 0, kind30023: 0, receivedReactions: 0 });
    }
    monthlyMap.get(monthKey)![kind]++;
  };

  // Process own events
  for (const event of ownEvents) {
    switch (event.kind) {
      case 1:
        stats.kind1Count++;
        stats.kind1Chars += countCharsWithoutUrls(event.content);
        stats.imageCount += countImages(event.content);
        ownKind1Ids.add(event.id);
        addToMonthly(event.created_at, 'kind1');
        
        // Track outgoing replies
        if (isReply(event.tags)) {
          const targetPubkeys = extractPubkeysFromTags(event.tags);
          for (const targetPubkey of targetPubkeys) {
            if (targetPubkey !== pubkey) {
              addToCountMap(outgoingReplies, targetPubkey);
            }
          }
        }
        break;
        
      case 6:
        stats.kind6Count++;
        addToMonthly(event.created_at, 'kind6');
        break;
        
      case 7:
        stats.kind7Count++;
        addToMonthly(event.created_at, 'kind7');
        // Track outgoing reactions
        const reactionTargets = extractPubkeysFromTags(event.tags);
        for (const targetPubkey of reactionTargets) {
          if (targetPubkey !== pubkey) {
            addToCountMap(outgoingReactions, targetPubkey);
          }
        }
        // Track reaction emoji
        const emoji = event.content || '+';
        addToCountMap(reactionEmojiCounts, emoji);
        break;
        
      case 42:
        stats.kind42Count++;
        addToMonthly(event.created_at, 'kind42');
        break;
        
      case 30023:
        stats.kind30023Count++;
        stats.kind30023Chars += countCharsWithoutUrls(event.content);
        addToMonthly(event.created_at, 'kind30023');
        break;
    }
  }

  // Process incoming reactions (reactions to my posts)
  for (const reaction of incomingReactionsEvents) {
    if (reaction.pubkey === pubkey) continue; // Skip self-reactions
    
    // Find which of my posts this reaction is for
    const eTag = reaction.tags.find(t => t[0] === 'e');
    if (eTag) {
      const postId = eTag[1];
      // Only count if it's a reaction to my kind 1 post
      if (ownKind1Ids.has(postId)) {
        kind1ReactionCounts.set(postId, (kind1ReactionCounts.get(postId) || 0) + 1);
      }
      addToCountMap(incomingReactions, reaction.pubkey);
      // Track received reactions
      stats.receivedReactionsCount++;
      addToMonthly(reaction.created_at, 'receivedReactions');
    }
  }

  // Process replies
  for (const event of mentionEvents) {
    if (event.pubkey !== pubkey && isReply(event.tags)) {
      addToCountMap(incomingReplies, event.pubkey);
    }
  }

  onProgress?.({
    phase: 'calculating',
    message: 'Calculating statistics...',
    progress: 80,
  });

  // Find top 3 posts by reaction count
  const sortedPosts: TopPostInfo[] = Array.from(kind1ReactionCounts.entries())
    .map(([id, reactionCount]) => ({ id, reactionCount }))
    .sort((a, b) => b.reactionCount - a.reactionCount)
    .slice(0, 3);
  
  stats.topPosts = sortedPosts;

  // Find top 10 reaction emojis
  const sortedEmojis: TopReactionEmoji[] = Array.from(reactionEmojiCounts.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  stats.topReactionEmojis = sortedEmojis;

  // Convert monthly map to sorted array
  stats.monthlyActivity = Array.from(monthlyMap.entries())
    .map(([month, counts]) => ({
      month,
      kind1: counts.kind1,
      kind6: counts.kind6,
      kind7: counts.kind7,
      kind42: counts.kind42,
      kind30023: counts.kind30023,
      receivedReactions: counts.receivedReactions,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  onProgress?.({
    phase: 'calculating',
    message: 'Calculating statistics...',
    progress: 90,
  });

  // Calculate friend scores
  stats.friendsRanking = calculateFriendScores({
    outgoingReactions,
    outgoingReplies,
    incomingReactions,
    incomingReplies,
  }).slice(0, 10); // Top 10

  onProgress?.({
    phase: 'done',
    message: 'Done!',
    progress: 100,
  });

  return stats;
}

/**
 * Fetch a specific event by ID
 */
export async function fetchEventById(
  eventId: string,
  relays: string[] = DEFAULT_RELAYS
): Promise<NostrEvent | null> {
  const f = initFetcher();
  
  try {
    const events = await f.fetchAllEvents(
      relays,
      { ids: [eventId] },
      {}
    );
    return events[0] || null;
  } catch (error) {
    console.error('Error fetching event:', error);
    return null;
  }
}

/**
 * Fetch profiles for multiple pubkeys
 */
export async function fetchProfiles(
  pubkeys: string[],
  relays: string[] = DEFAULT_RELAYS
): Promise<Map<string, NostrProfile>> {
  const f = initFetcher();
  const profiles = new Map<string, NostrProfile>();
  
  try {
    const events = await f.fetchAllEvents(
      relays,
      { kinds: [0], authors: pubkeys },
      {}
    );
    
    for (const event of events) {
      try {
        profiles.set(event.pubkey, JSON.parse(event.content));
      } catch {
        // Invalid JSON, skip
      }
    }
  } catch (error) {
    console.error('Error fetching profiles:', error);
  }
  
  return profiles;
}
