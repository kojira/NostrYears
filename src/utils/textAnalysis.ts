// URL pattern to match various URL formats
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

// Image URL extensions
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?[^\s]*)?$/i;

/**
 * Remove all URLs from text content
 */
export function removeUrls(text: string): string {
  return text.replace(URL_PATTERN, '').trim();
}

/**
 * Count characters excluding URLs
 */
export function countCharsWithoutUrls(text: string): number {
  return removeUrls(text).length;
}

/**
 * Extract image URLs from content
 */
export function extractImageUrls(text: string): string[] {
  const urls = text.match(URL_PATTERN) || [];
  return urls.filter(url => IMAGE_EXTENSIONS.test(url));
}

/**
 * Count images in content
 */
export function countImages(text: string): number {
  return extractImageUrls(text).length;
}

/**
 * Extract p tags (pubkeys) from event tags
 */
export function extractPubkeysFromTags(tags: string[][]): string[] {
  return tags
    .filter(tag => tag[0] === 'p' && tag[1])
    .map(tag => tag[1]);
}

/**
 * Extract e tags (event IDs) from event tags
 */
export function extractEventIdsFromTags(tags: string[][]): string[] {
  return tags
    .filter(tag => tag[0] === 'e' && tag[1])
    .map(tag => tag[1]);
}

/**
 * Check if an event is a reply (has 'e' tag with reply marker or is root)
 */
export function isReply(tags: string[][]): boolean {
  // Check for e tags - if present, it's a reply
  return tags.some(tag => tag[0] === 'e' && tag[1]);
}

/**
 * Get the reply target pubkey from tags (the author of the replied-to post)
 * Returns the first p tag pubkey as it usually represents the reply target
 */
export function getReplyTargetPubkeys(tags: string[][]): string[] {
  return extractPubkeysFromTags(tags);
}

