// NIP-07 window.nostr extension interface
export interface Nip07Nostr {
  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedEvent): Promise<SignedEvent>;
}

declare global {
  interface Window {
    nostr?: Nip07Nostr;
  }
}

// Nostr event types
export interface UnsignedEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
}

export interface SignedEvent extends UnsignedEvent {
  id: string;
  pubkey: string;
  sig: string;
}

// NostrYears statistics
export interface NostrYearsStats {
  pubkey: string;
  profile: NostrProfile | null;
  relays: string[];
  period: {
    since: number;
    until: number;
  };
  kind1Count: number;
  kind1Chars: number;
  kind30023Count: number;
  kind30023Chars: number;
  kind6Count: number;
  kind7Count: number;
  kind42Count: number;
  imageCount: number;
  topPostId: string | null;
  topPostReactionCount: number;
  friendsRanking: FriendScore[];
}

export interface FriendScore {
  pubkey: string;
  outgoingReactions: number;
  outgoingReplies: number;
  incomingReactions: number;
  incomingReplies: number;
  balanceScore: number; // 0-1, higher is more balanced (50% each direction)
}

// App version for cache invalidation
export const NOSTR_YEARS_VERSION = 2;

// kind 30078 event content structure
export interface NostrYearsEventContent {
  version: number;
  relays: string[];
  period: {
    since: number;
    until: number;
  };
  kind1Count: number;
  kind1Chars: number;
  kind30023Count: number;
  kind30023Chars: number;
  kind6Count: number;
  kind7Count: number;
  kind42Count: number;
  imageCount: number;
  topPostId: string | null;
  topPostReactionCount: number;
}

// Percentile data
export interface PercentileData {
  kind1Count: number;
  kind1Chars: number;
  kind30023Count: number;
  kind6Count: number;
  kind7Count: number;
  kind42Count: number;
  imageCount: number;
  topPostReactionCount: number;
}

// Progress state
export interface FetchProgress {
  phase: 'idle' | 'fetching_own' | 'fetching_reactions' | 'fetching_mentions' | 'calculating' | 'done';
  message: string;
  progress: number; // 0-100
}

// Profile metadata
export interface NostrProfile {
  name?: string;
  display_name?: string;
  picture?: string;
  about?: string;
  nip05?: string;
}

