import type { FriendScore } from '../types/nostr';

// Weight for replies (2x compared to reactions)
const REPLY_WEIGHT = 2;
const REACTION_WEIGHT = 1;

interface InteractionData {
  outgoingReactions: Map<string, number>; // pubkey -> count
  outgoingReplies: Map<string, number>;   // pubkey -> count
  incomingReactions: Map<string, number>; // pubkey -> count
  incomingReplies: Map<string, number>;   // pubkey -> count
}

/**
 * Calculate friend scores from interaction data
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

    // Skip if there's no bidirectional reaction interaction
    // Either outgoing or incoming reactions must be > 0
    if (outgoingReactions === 0 && incomingReactions === 0) {
      continue;
    }

    const score = 
      (outgoingReactions * REACTION_WEIGHT) +
      (outgoingReplies * REPLY_WEIGHT) +
      (incomingReactions * REACTION_WEIGHT) +
      (incomingReplies * REPLY_WEIGHT);

    if (score > 0) {
      scores.push({
        pubkey,
        score,
        outgoingReactions,
        outgoingReplies,
        incomingReactions,
        incomingReplies,
      });
    }
  }

  // Sort by score descending
  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Add to a count map
 */
export function addToCountMap(map: Map<string, number>, key: string, count: number = 1): void {
  map.set(key, (map.get(key) || 0) + count);
}

