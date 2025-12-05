import { Relay } from 'nostr-tools';
import type { NostrYearsStats, NostrYearsEventContent, UnsignedEvent } from '../types/nostr';
import { NOSTR_YEARS_VERSION } from '../types/nostr';
import { DEFAULT_RELAYS, initFetcher } from './nostrFetcher';

const NOSTR_YEARS_D_TAG = 'nostr-years-2025';
const NOSTR_YEARS_KIND = 30078;

/**
 * Check if NIP-07 extension is available
 */
export function hasNip07(): boolean {
  return typeof window !== 'undefined' && !!window.nostr;
}

/**
 * Get public key from NIP-07 extension
 */
export async function getPubkeyFromNip07(): Promise<string | null> {
  if (!hasNip07()) return null;
  
  try {
    return await window.nostr!.getPublicKey();
  } catch (error) {
    console.error('Error getting pubkey from NIP-07:', error);
    return null;
  }
}

/**
 * Create NostrYears event content from stats
 */
export function createEventContent(stats: NostrYearsStats): NostrYearsEventContent {
  return {
    version: NOSTR_YEARS_VERSION,
    relays: stats.relays,
    period: stats.period,
    kind1Count: stats.kind1Count,
    kind1Chars: stats.kind1Chars,
    kind30023Count: stats.kind30023Count,
    kind30023Chars: stats.kind30023Chars,
    kind6Count: stats.kind6Count,
    kind7Count: stats.kind7Count,
    receivedReactionsCount: stats.receivedReactionsCount,
    kind42Count: stats.kind42Count,
    imageCount: stats.imageCount,
    topPosts: stats.topPosts,
    topReactionEmojis: stats.topReactionEmojis,
    monthlyActivity: stats.monthlyActivity,
    hourlyActivity: stats.hourlyActivity,
    zapsReceived: stats.zapsReceived,
    zapsSent: stats.zapsSent,
  };
}

/**
 * Publish NostrYears stats to relays using NIP-07
 * Also publishes a kind 1 note with the summary text
 */
export async function publishNostrYearsStats(
  stats: NostrYearsStats,
  summaryText: string,
  relays: string[] = DEFAULT_RELAYS
): Promise<boolean> {
  if (!hasNip07()) {
    console.error('NIP-07 extension not available');
    return false;
  }

  const content = createEventContent(stats);
  
  // Kind 30078 event (stats data)
  const statsEvent: UnsignedEvent = {
    kind: NOSTR_YEARS_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', NOSTR_YEARS_D_TAG],
      ['version', String(NOSTR_YEARS_VERSION)],
    ],
    content: JSON.stringify(content),
  };

  // Kind 1 event (summary post)
  const noteEvent: UnsignedEvent = {
    kind: 1,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', 'nostryears'],
    ],
    content: summaryText,
  };

  try {
    // Sign both events with NIP-07
    const signedStatsEvent = await window.nostr!.signEvent(statsEvent);
    const signedNoteEvent = await window.nostr!.signEvent(noteEvent);
    
    // Publish to relays
    const publishPromises = relays.map(async (relayUrl) => {
      try {
        const relay = await Relay.connect(relayUrl);
        await relay.publish(signedStatsEvent);
        await relay.publish(signedNoteEvent);
        relay.close();
        return true;
      } catch (error) {
        console.error(`Failed to publish to ${relayUrl}:`, error);
        return false;
      }
    });

    const results = await Promise.all(publishPromises);
    return results.some(r => r); // Success if at least one relay accepted
  } catch (error) {
    console.error('Error signing/publishing event:', error);
    return false;
  }
}

/**
 * Fetch all NostrYears events from relays (for percentile calculation)
 * Only returns events with matching version
 */
export async function fetchAllNostrYearsEvents(
  relays: string[] = DEFAULT_RELAYS
): Promise<NostrYearsEventContent[]> {
  const fetcher = initFetcher();
  
  try {
    const events = await fetcher.fetchAllEvents(
      relays,
      { 
        kinds: [NOSTR_YEARS_KIND],
        '#d': [NOSTR_YEARS_D_TAG],
      },
      {}
    );

    const contents: NostrYearsEventContent[] = [];
    
    for (const event of events) {
      try {
        const content = JSON.parse(event.content) as NostrYearsEventContent;
        // Validate version only (period can vary)
        if (content.version === NOSTR_YEARS_VERSION) {
          contents.push(content);
        }
      } catch {
        // Invalid JSON, skip
      }
    }
    
    return contents;
  } catch (error) {
    console.error('Error fetching NostrYears events:', error);
    return [];
  }
}

/**
 * Fetch user's own NostrYears event
 */
export async function fetchOwnNostrYearsEvent(
  pubkey: string,
  relays: string[] = DEFAULT_RELAYS
): Promise<NostrYearsEventContent | null> {
  const fetcher = initFetcher();
  
  try {
    const event = await fetcher.fetchLastEvent(
      relays,
      {
        kinds: [NOSTR_YEARS_KIND],
        authors: [pubkey],
        '#d': [NOSTR_YEARS_D_TAG],
      }
    );

    if (event) {
      const content = JSON.parse(event.content) as NostrYearsEventContent;
      // Validate version only
      if (content.version === NOSTR_YEARS_VERSION) {
        return content;
      }
    }
  } catch (error) {
    console.error('Error fetching own NostrYears event:', error);
  }
  
  return null;
}

/**
 * Check if arrays have the same elements (order independent)
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

/**
 * Fetch user's own NostrYears event with matching relays and version
 */
export async function fetchOwnNostrYearsEventWithRelays(
  pubkey: string,
  relays: string[]
): Promise<NostrYearsEventContent | null> {
  const content = await fetchOwnNostrYearsEvent(pubkey, relays);
  
  if (content && content.relays && arraysEqual(content.relays, relays)) {
    return content;
  }
  
  return null;
}

// Recent result with pubkey
export interface RecentNostrYearsResult {
  pubkey: string;
  createdAt: number;
  content: NostrYearsEventContent;
}

/**
 * Fetch recent NostrYears events from relays
 */
export async function fetchRecentNostrYearsEvents(
  relays: string[] = DEFAULT_RELAYS,
  limit: number = 20
): Promise<RecentNostrYearsResult[]> {
  const fetcher = initFetcher();
  
  try {
    const events = await fetcher.fetchAllEvents(
      relays,
      { 
        kinds: [NOSTR_YEARS_KIND],
        '#d': [NOSTR_YEARS_D_TAG],
      },
      {},
      { sort: true }
    );

    const results: RecentNostrYearsResult[] = [];
    const seenPubkeys = new Set<string>();
    
    for (const event of events) {
      // Skip if we already have a result from this pubkey (keep most recent)
      if (seenPubkeys.has(event.pubkey)) continue;
      
      try {
        const content = JSON.parse(event.content) as NostrYearsEventContent;
        // Accept any version (show all results)
        if (content.version) {
          seenPubkeys.add(event.pubkey);
          results.push({
            pubkey: event.pubkey,
            createdAt: event.created_at,
            content,
          });
          
          if (results.length >= limit) break;
        }
      } catch {
        // Invalid JSON, skip
      }
    }
    
    // Sort by createdAt descending
    return results.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error fetching recent NostrYears events:', error);
    return [];
  }
}
