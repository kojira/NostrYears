import { Relay } from 'nostr-tools';
import type { NostrYearsStats, NostrYearsEventContent, UnsignedEvent } from '../types/nostr';
import { DEFAULT_RELAYS, PERIOD_SINCE, PERIOD_UNTIL, initFetcher } from './nostrFetcher';

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
    relays: stats.relays,
    period: stats.period,
    kind1Count: stats.kind1Count,
    kind1Chars: stats.kind1Chars,
    kind30023Count: stats.kind30023Count,
    kind30023Chars: stats.kind30023Chars,
    kind6Count: stats.kind6Count,
    kind7Count: stats.kind7Count,
    kind42Count: stats.kind42Count,
    imageCount: stats.imageCount,
    topPostId: stats.topPostId,
    topPostReactionCount: stats.topPostReactionCount,
  };
}

/**
 * Publish NostrYears stats to relays using NIP-07
 */
export async function publishNostrYearsStats(
  stats: NostrYearsStats,
  relays: string[] = DEFAULT_RELAYS
): Promise<boolean> {
  if (!hasNip07()) {
    console.error('NIP-07 extension not available');
    return false;
  }

  const content = createEventContent(stats);
  
  const unsignedEvent: UnsignedEvent = {
    kind: NOSTR_YEARS_KIND,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', NOSTR_YEARS_D_TAG],
      ['version', '1'],
    ],
    content: JSON.stringify(content),
  };

  try {
    // Sign with NIP-07
    const signedEvent = await window.nostr!.signEvent(unsignedEvent);
    
    // Publish to relays
    const publishPromises = relays.map(async (relayUrl) => {
      try {
        const relay = await Relay.connect(relayUrl);
        await relay.publish(signedEvent);
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
        // Validate that it's for the correct period
        if (content.period?.since === PERIOD_SINCE && content.period?.until === PERIOD_UNTIL) {
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
      if (content.period?.since === PERIOD_SINCE && content.period?.until === PERIOD_UNTIL) {
        return content;
      }
    }
  } catch (error) {
    console.error('Error fetching own NostrYears event:', error);
  }
  
  return null;
}

