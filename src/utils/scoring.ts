import type { FriendScore } from '../types/nostr';

interface InteractionData {
  outgoingReactions: Map<string, number>; // pubkey -> count
  outgoingReplies: Map<string, number>;   // pubkey -> count
  incomingReactions: Map<string, number>; // pubkey -> count
  incomingReplies: Map<string, number>;   // pubkey -> count
}

/**
 * Calculate balance score (0-1)
 * Higher score means more balanced interaction (closer to 50% each direction)
 * 
 * Formula: 1 - |outgoing - incoming| / total
 * - 50/50 split = 1.0 (perfect balance)
 * - 100/0 or 0/100 = 0.0 (no balance)
 */
function calculateBalanceScore(outgoing: number, incoming: number): number {
  const total = outgoing + incoming;
  if (total === 0) return 0;
  
  const diff = Math.abs(outgoing - incoming);
  return 1 - (diff / total);
}

/**
 * Calculate friend scores from interaction data
 * 
 * Ranking criteria:
 * 1. Primary sort: Number of reactions sent by me (outgoingReactions) - descending
 * 2. Secondary: Balance score (how close to 50/50 the interaction is) - descending
 * 
 * Filter: Must have outgoing reactions > 0 (I must have reacted to them)
 */
export function calculateFriendScores(data: InteractionData): FriendScore[] {
  const allPubkeys = new Set<string>([
    ...data.outgoingReactions.keys(),
    ...data.outgoingReplies.keys(),
    ...data.incomingReactions.keys(),
    ...data.incomingReplies.keys(),
  ]);

  const scores: FriendScore[] = [];

  for (const pubkey of allPubkeys) {
    const outgoingReactions = data.outgoingReactions.get(pubkey) || 0;
    const outgoingReplies = data.outgoingReplies.get(pubkey) || 0;
    const incomingReactions = data.incomingReactions.get(pubkey) || 0;
    const incomingReplies = data.incomingReplies.get(pubkey) || 0;

    // Must have sent at least one reaction to this person
    if (outgoingReactions === 0) {
      continue;
    }

    // Calculate balance score based on all interactions
    const totalOutgoing = outgoingReactions + outgoingReplies;
    const totalIncoming = incomingReactions + incomingReplies;
    const balanceScore = calculateBalanceScore(totalOutgoing, totalIncoming);

    scores.push({
      pubkey,
      outgoingReactions,
      outgoingReplies,
      incomingReactions,
      incomingReplies,
      balanceScore,
    });
  }

  // Sort by:
  // 1. outgoingReactions descending (primary)
  // 2. balanceScore descending (secondary - closer to 50% is better)
  return scores.sort((a, b) => {
    if (b.outgoingReactions !== a.outgoingReactions) {
      return b.outgoingReactions - a.outgoingReactions;
    }
    return b.balanceScore - a.balanceScore;
  });
}

/**
 * Add to a count map
 */
export function addToCountMap(map: Map<string, number>, key: string, count: number = 1): void {
  map.set(key, (map.get(key) || 0) + count);
}
