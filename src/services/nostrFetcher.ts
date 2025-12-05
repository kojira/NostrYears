import { NostrFetcher } from 'nostr-fetch';
import type { NostrEvent } from 'nostr-fetch';
import type { NostrYearsStats, FetchProgress, NostrProfile } from '../types/nostr';
import { countCharsWithoutUrls, countImages, extractPubkeysFromTags, isReply } from '../utils/textAnalysis';
import { calculateFriendScores, addToCountMap } from '../utils/scoring';

// Default relays
export const DEFAULT_RELAYS = ['wss://r.kojira.io', 'wss://yabu.me'];

// Time range: 2025/1/1 0:00:00 JST to 2025/12/1 0:00:00 JST
// JST = UTC + 9 hours
// 2025/1/1 0:00:00 JST = 2024/12/31 15:00:00 UTC
// 2025/12/1 0:00:00 JST = 2025/11/30 15:00:00 UTC
export const PERIOD_SINCE = Math.floor(new Date('2024-12-31T15:00:00Z').getTime() / 1000);
export const PERIOD_UNTIL = Math.floor(new Date('2025-11-30T15:00:00Z').getTime() / 1000);

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
  onProgress?: (progress: FetchProgress) => void
): Promise<NostrYearsStats> {
  const f = initFetcher();
  
  const stats: NostrYearsStats = {
    pubkey,
    period: { since: PERIOD_SINCE, until: PERIOD_UNTIL },
    kind1Count: 0,
    kind1Chars: 0,
    kind30023Count: 0,
    kind30023Chars: 0,
    kind6Count: 0,
    kind7Count: 0,
    kind42Count: 0,
    imageCount: 0,
    topPostId: null,
    topPostReactionCount: 0,
    friendsRanking: [],
  };

  // Maps for friend scoring
  const outgoingReactions = new Map<string, number>();
  const outgoingReplies = new Map<string, number>();
  const incomingReactions = new Map<string, number>();
  const incomingReplies = new Map<string, number>();
  
  // Store own kind 1 event IDs for later reaction lookup
  const ownKind1Ids: string[] = [];
  const kind1ReactionCounts = new Map<string, number>();

  // Phase 1: Fetch own events
  onProgress?.({
    phase: 'fetching_own',
    message: '自分の投稿を取得中...',
    progress: 10,
  });

  // Fetch own events (kind 1, 6, 7, 42, 30023)
  const ownEvents = await f.fetchAllEvents(
    relays,
    { kinds: [1, 6, 7, 42, 30023], authors: [pubkey] },
    { since: PERIOD_SINCE, until: PERIOD_UNTIL },
    { sort: true }
  );

  for (const event of ownEvents) {
    switch (event.kind) {
      case 1:
        stats.kind1Count++;
        stats.kind1Chars += countCharsWithoutUrls(event.content);
        stats.imageCount += countImages(event.content);
        ownKind1Ids.push(event.id);
        
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
        break;
        
      case 7:
        stats.kind7Count++;
        // Track outgoing reactions
        const reactionTargets = extractPubkeysFromTags(event.tags);
        for (const targetPubkey of reactionTargets) {
          if (targetPubkey !== pubkey) {
            addToCountMap(outgoingReactions, targetPubkey);
          }
        }
        break;
        
      case 42:
        stats.kind42Count++;
        break;
        
      case 30023:
        stats.kind30023Count++;
        stats.kind30023Chars += countCharsWithoutUrls(event.content);
        break;
    }
  }

  onProgress?.({
    phase: 'fetching_reactions',
    message: '自分への反応を取得中...',
    progress: 40,
  });

  // Phase 2: Fetch reactions to own posts (in batches)
  const batchSize = 50;
  for (let i = 0; i < ownKind1Ids.length; i += batchSize) {
    const batch = ownKind1Ids.slice(i, i + batchSize);
    
    const reactions = await f.fetchAllEvents(
      relays,
      { kinds: [7], '#e': batch },
      { since: PERIOD_SINCE, until: PERIOD_UNTIL }
    );

    for (const reaction of reactions) {
      // Find which of my posts this reaction is for
      const eTag = reaction.tags.find(t => t[0] === 'e' && batch.includes(t[1]));
      if (eTag) {
        const postId = eTag[1];
        kind1ReactionCounts.set(postId, (kind1ReactionCounts.get(postId) || 0) + 1);
        
        // Track incoming reactions
        if (reaction.pubkey !== pubkey) {
          addToCountMap(incomingReactions, reaction.pubkey);
        }
      }
    }

    onProgress?.({
      phase: 'fetching_reactions',
      message: `自分への反応を取得中... (${Math.min(i + batchSize, ownKind1Ids.length)}/${ownKind1Ids.length})`,
      progress: 40 + (i / ownKind1Ids.length) * 20,
    });
  }

  // Find top post
  let topPostId: string | null = null;
  let topReactionCount = 0;
  for (const [postId, count] of kind1ReactionCounts) {
    if (count > topReactionCount) {
      topReactionCount = count;
      topPostId = postId;
    }
  }
  stats.topPostId = topPostId;
  stats.topPostReactionCount = topReactionCount;

  onProgress?.({
    phase: 'fetching_mentions',
    message: '自分へのリプライを取得中...',
    progress: 70,
  });

  // Phase 3: Fetch replies mentioning me (kind 1 with #p tag)
  const mentionEvents = await f.fetchAllEvents(
    relays,
    { kinds: [1], '#p': [pubkey] },
    { since: PERIOD_SINCE, until: PERIOD_UNTIL }
  );

  for (const event of mentionEvents) {
    if (event.pubkey !== pubkey && isReply(event.tags)) {
      addToCountMap(incomingReplies, event.pubkey);
    }
  }

  onProgress?.({
    phase: 'calculating',
    message: '統計を計算中...',
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
    message: '完了！',
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

