/**
 * The shape of the cached list index, and the rule for when it may still be served.
 *
 * Kept free of any browser or storage import so it can be unit tested directly; importing
 * the storage binding pulls in @wxt-dev/storage, which reaches for chrome.runtime at module
 * load and throws outside an extension context.
 */

export type CachedList = {
  id: string;
  name: string;
  parentId: string | null;
  description: string | null;
};

export type ListIndexCache = {
  lists: CachedList[];
  syncedAt: string;
};

/**
 * How long a cached list index is served without going back to the server.
 *
 * Serving it indefinitely is what let a group deleted on another machine keep appearing in
 * Recent until some caller happened to force a refresh.
 */
export const LIST_CACHE_TTL_MS = 60_000;

/**
 * A timestamp in the future means the two machines disagree about the clock, which is not a
 * reason to trust the cache for longer than usual.
 */
export function isCacheFresh(syncedAt: string, now: number): boolean {
  const synced = Date.parse(syncedAt);
  if (!Number.isFinite(synced)) return false;
  return synced <= now && now - synced < LIST_CACHE_TTL_MS;
}
