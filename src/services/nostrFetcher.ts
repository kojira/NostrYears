import { NostrFetcher } from 'nostr-fetch';
import type { NostrEvent } from 'nostr-fetch';
import type { NostrYearsStats, FetchProgress, NostrProfile, TopPostInfo, TopReactionEmoji } from '../types/nostr';
import { countCharsWithoutUrls, countImages, extractPubkeysFromTags, isReply } from '../utils/textAnalysis';
import { calculateFriendScores, addToCountMap } from '../utils/scoring';
import { decode as decodeBolt11 } from 'light-bolt11-decoder';

// Helper to extract sats amount from bolt11 invoice
function extractSatsFromBolt11(bolt11: string): number {
  try {
    const decoded = decodeBolt11(bolt11);
    const amountSection = decoded.sections.find((s: { name: string }) => s.name === 'amount');
    if (amountSection && 'value' in amountSection) {
      // Amount is in millisatoshis
      return Math.floor(Number(amountSection.value) / 1000);
    }
  } catch {
    // Failed to decode
  }
  return 0;
}


// Helper to get month key from timestamp
function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Helper to get hour from timestamp (JST timezone)
function getHourJST(timestamp: number): number {
  const date = new Date(timestamp * 1000);
  // Convert to JST (UTC + 9 hours)
  const jstHours = (date.getUTCHours() + 9) % 24;
  return jstHours;
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
    fetcher = NostrFetcher.init({
      minLogLevel: 'warn',
    });
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
 * Test if a relay is reachable by attempting WebSocket connection
 * Returns true if connection succeeds within timeout
 */
async function testRelayConnection(relayUrl: string, timeoutMs: number = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(relayUrl);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, timeoutMs);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(false);
      };
    } catch {
      resolve(false);
    }
  });
}

/**
 * Fetch user's relay list (NIP-65, kind 10002)
 * Returns an array of relay URLs that are marked for read or read/write
 * Only returns relays that pass connection test
 */
export async function fetchRelayList(pubkey: string, relays: string[] = DEFAULT_RELAYS): Promise<string[]> {
  const f = initFetcher();
  
  try {
    const event = await f.fetchLastEvent(relays, {
      kinds: [10002],
      authors: [pubkey],
    });
    
    if (event) {
      const relayUrls: string[] = [];
      for (const tag of event.tags) {
        if (tag[0] === 'r' && tag[1]) {
          // If no marker or marker is "read" or no marker (both read/write), include it
          const marker = tag[2];
          if (!marker || marker === 'read') {
            relayUrls.push(tag[1]);
          }
        }
      }
      
      // Test each relay connection in parallel
      const testResults = await Promise.all(
        relayUrls.map(async (url) => ({
          url,
          reachable: await testRelayConnection(url),
        }))
      );
      
      // Return only reachable relays
      const reachableRelays = testResults
        .filter((r) => r.reachable)
        .map((r) => r.url);
      
      console.log(`Relay test: ${reachableRelays.length}/${relayUrls.length} relays reachable`);
      
      return reachableRelays;
    }
  } catch (error) {
    console.error('Error fetching relay list:', error);
  }
  
  return [];
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

  // Phase 1: Fetch own events (5% - 40%)
  const ownEvents = await fetchWithProgress(
    { kinds: [1, 6, 7, 42, 30023], authors: [pubkey] },
    'Fetching posts...',
    5,
    40
  );

  // Phase 2: Fetch incoming events (reactions, replies, received zaps) (40% - 70%)
  onProgress?.({
    phase: 'fetching_reactions',
    message: 'Fetching reactions, replies, zaps...',
    progress: 40,
  });

  const incomingEvents = await fetchWithProgress(
    { kinds: [1, 7, 9735], '#p': [pubkey] },
    'Fetching reactions, replies, received zaps...',
    40,
    70
  );

  // Phase 3: Fetch sent zaps (70% - 80%)
  // Use #P tag (uppercase) for zap sender - need to use raw filter
  onProgress?.({
    phase: 'fetching_reactions',
    message: 'Fetching sent zaps...',
    progress: 70,
  });

  let sentZaps: NostrEvent[] = [];
  try {
    sentZaps = await f.fetchAllEvents(
      relays,
      { kinds: [9735], '#P': [pubkey] } as Parameters<typeof f.fetchAllEvents>[1],
      { since: periodSince, until: periodUntil }
    );
  } catch (error) {
    console.error('Error fetching sent zaps:', error);
  }

  // Wait for profile
  const profile = await profilePromise;

  onProgress?.({
    phase: 'calculating',
    message: 'Processing data...',
    progress: 65,
  });

  // Monthly activity tracking
  const monthlyMap = new Map<string, { kind1: number; kind6: number; kind7: number; kind42: number; kind30023: number; receivedReactions: number; zapsSent: number; zapsReceived: number }>();

  // Hourly activity tracking (24 hours, JST)
  const hourlyMap = new Map<number, number>();
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, 0);
  }

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
    hourlyActivity: [],
    zapsReceived: { count: 0, totalSats: 0, averageSats: 0 },
    zapsSent: { count: 0, totalSats: 0, averageSats: 0 },
  };

  // Helper to increment monthly count
  const addToMonthly = (timestamp: number, kind: 'kind1' | 'kind6' | 'kind7' | 'kind42' | 'kind30023' | 'receivedReactions' | 'zapsSent' | 'zapsReceived') => {
    const monthKey = getMonthKey(timestamp);
    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, { kind1: 0, kind6: 0, kind7: 0, kind42: 0, kind30023: 0, receivedReactions: 0, zapsSent: 0, zapsReceived: 0 });
    }
    monthlyMap.get(monthKey)![kind]++;
  };

  // Helper to increment hourly count (JST timezone)
  const addToHourly = (timestamp: number) => {
    const hour = getHourJST(timestamp);
    hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
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
        addToHourly(event.created_at);
        
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
        addToHourly(event.created_at);
        break;
        
      case 7:
        stats.kind7Count++;
        addToMonthly(event.created_at, 'kind7');
        addToHourly(event.created_at);
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
        addToHourly(event.created_at);
        break;
        
      case 30023:
        stats.kind30023Count++;
        stats.kind30023Chars += countCharsWithoutUrls(event.content);
        addToMonthly(event.created_at, 'kind30023');
        addToHourly(event.created_at);
        break;
        
    }
  }

  // Process incoming events (reactions, replies, zaps)
  for (const event of incomingEvents) {
    if (event.pubkey === pubkey) continue; // Skip self-events
    
    switch (event.kind) {
      case 7:
        // Reaction to my post
        const eTag = event.tags.find(t => t[0] === 'e');
        if (eTag) {
          const postId = eTag[1];
          if (ownKind1Ids.has(postId)) {
            kind1ReactionCounts.set(postId, (kind1ReactionCounts.get(postId) || 0) + 1);
          }
          addToCountMap(incomingReactions, event.pubkey);
          stats.receivedReactionsCount++;
          addToMonthly(event.created_at, 'receivedReactions');
        }
        break;
        
      case 1:
        // Reply mentioning me
        if (isReply(event.tags)) {
          addToCountMap(incomingReplies, event.pubkey);
        }
        break;
        
      case 9735:
        // Zap receipt to me
        const bolt11Tag = event.tags.find(t => t[0] === 'bolt11');
        if (bolt11Tag && bolt11Tag[1]) {
          const sats = extractSatsFromBolt11(bolt11Tag[1]);
          if (sats > 0) {
            stats.zapsReceived.count++;
            stats.zapsReceived.totalSats += sats;
            addToMonthly(event.created_at, 'zapsReceived');
          }
        }
        break;
    }
  }
  
  // Calculate average for received zaps
  stats.zapsReceived.averageSats = stats.zapsReceived.count > 0 
    ? Math.round(stats.zapsReceived.totalSats / stats.zapsReceived.count) 
    : 0;

  // Process sent zaps (kind 9735 with #P tag = sender)
  for (const event of sentZaps) {
    const bolt11Tag = event.tags.find(t => t[0] === 'bolt11');
    if (bolt11Tag && bolt11Tag[1]) {
      const sats = extractSatsFromBolt11(bolt11Tag[1]);
      if (sats > 0) {
        stats.zapsSent.count++;
        stats.zapsSent.totalSats += sats;
        addToMonthly(event.created_at, 'zapsSent');
      }
    }
  }
  
  // Calculate average for sent zaps
  stats.zapsSent.averageSats = stats.zapsSent.count > 0 
    ? Math.round(stats.zapsSent.totalSats / stats.zapsSent.count) 
    : 0;

  onProgress?.({
    phase: 'calculating',
    message: 'Calculating statistics...',
    progress: 85,
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
      zapsSent: counts.zapsSent,
      zapsReceived: counts.zapsReceived,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Convert hourly map to sorted array (0-23 hours in JST)
  stats.hourlyActivity = Array.from(hourlyMap.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour);

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
