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

// Top post info
export interface TopPostInfo {
  id: string;
  reactionCount: number;
}

// Top reaction emoji info
export interface TopReactionEmoji {
  emoji: string;
  count: number;
}

// Monthly activity data
export interface MonthlyActivity {
  month: string; // "YYYY-MM" format
  kind1: number;
  kind6: number;
  kind7: number;
  kind42: number;
  kind30023: number;
  receivedReactions: number; // Reactions received on my posts
}

// Zap statistics
export interface ZapStats {
  count: number;
  totalSats: number;
  averageSats: number;
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
  receivedReactionsCount: number;
  kind42Count: number;
  imageCount: number;
  topPosts: TopPostInfo[]; // Top 3 posts by reaction count
  topReactionEmojis: TopReactionEmoji[]; // Top 3 reaction emojis used
  friendsRanking: FriendScore[];
  monthlyActivity: MonthlyActivity[]; // Monthly activity breakdown
  zapsReceived: ZapStats;
  zapsSent: ZapStats;
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
export const NOSTR_YEARS_VERSION = 3;

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
  receivedReactionsCount: number;
  kind42Count: number;
  imageCount: number;
  topPosts: TopPostInfo[];
  topReactionEmojis: TopReactionEmoji[];
  monthlyActivity: MonthlyActivity[];
  zapsReceived: ZapStats;
  zapsSent: ZapStats;
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

