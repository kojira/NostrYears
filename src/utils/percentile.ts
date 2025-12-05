import type { NostrYearsEventContent, PercentileData } from '../types/nostr';

/**
 * Calculate percentile rank (higher is better)
 * Returns the percentage of values that are BELOW the given value
 */
export function calculatePercentile(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 0;
  
  const sorted = [...allValues].sort((a, b) => a - b);
  const belowCount = sorted.filter(v => v < value).length;
  
  // Return as "top X%" - so higher values mean top performers
  return Math.round(100 - (belowCount / sorted.length) * 100);
}

/**
 * Get top post reaction count from stats (first post or 0)
 */
function getTopReactionCount(stats: NostrYearsEventContent): number {
  return stats.topPosts?.[0]?.reactionCount || 0;
}

/**
 * Calculate percentiles for all stats
 */
export function calculateAllPercentiles(
  myStats: NostrYearsEventContent,
  allStats: NostrYearsEventContent[]
): PercentileData {
  const kind1Counts = allStats.map(s => s.kind1Count);
  const kind1CharsList = allStats.map(s => s.kind1Chars);
  const kind30023Counts = allStats.map(s => s.kind30023Count);
  const kind6Counts = allStats.map(s => s.kind6Count);
  const kind7Counts = allStats.map(s => s.kind7Count);
  const kind42Counts = allStats.map(s => s.kind42Count);
  const imageCounts = allStats.map(s => s.imageCount);
  const topPostReactionCounts = allStats.map(s => getTopReactionCount(s));

  return {
    kind1Count: calculatePercentile(myStats.kind1Count, kind1Counts),
    kind1Chars: calculatePercentile(myStats.kind1Chars, kind1CharsList),
    kind30023Count: calculatePercentile(myStats.kind30023Count, kind30023Counts),
    kind6Count: calculatePercentile(myStats.kind6Count, kind6Counts),
    kind7Count: calculatePercentile(myStats.kind7Count, kind7Counts),
    kind42Count: calculatePercentile(myStats.kind42Count, kind42Counts),
    imageCount: calculatePercentile(myStats.imageCount, imageCounts),
    topPostReactionCount: calculatePercentile(getTopReactionCount(myStats), topPostReactionCounts),
  };
}

/**
 * Format percentile for display
 */
export function formatPercentile(percentile: number): string {
  if (percentile <= 1) return 'Top 1%';
  if (percentile <= 5) return 'Top 5%';
  if (percentile <= 10) return 'Top 10%';
  if (percentile <= 25) return 'Top 25%';
  if (percentile <= 50) return 'Top 50%';
  return `Top ${percentile}%`;
}

