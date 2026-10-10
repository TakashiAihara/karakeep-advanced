import { describe, expect, it } from 'vitest';
import { isCacheFresh, LIST_CACHE_TTL_MS } from '@/src/storage/list-cache';

const NOW = Date.parse('2026-08-28T12:00:00.000Z');

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

describe('isCacheFresh', () => {
  it('serves a cache written just now', () => {
    expect(isCacheFresh(ago(0), NOW)).toBe(true);
  });

  it('serves a cache just inside the window', () => {
    expect(isCacheFresh(ago(LIST_CACHE_TTL_MS - 1), NOW)).toBe(true);
  });

  // Without an upper bound, a group deleted on another machine kept being offered in
  // Recent until some caller happened to force a refresh.
  it('refetches once the window has passed', () => {
    expect(isCacheFresh(ago(LIST_CACHE_TTL_MS), NOW)).toBe(false);
  });

  it('refetches for a cache written long ago', () => {
    expect(isCacheFresh(ago(24 * 60 * 60 * 1000), NOW)).toBe(false);
  });

  it.each(['', 'not a date'])('refetches when the timestamp %j cannot be read', (value) => {
    expect(isCacheFresh(value, NOW)).toBe(false);
  });

  // A future timestamp means the two machines disagree about the clock, which is not a
  // reason to trust the cache for longer.
  it('refetches when the timestamp is in the future', () => {
    expect(isCacheFresh(new Date(NOW + 60_000).toISOString(), NOW)).toBe(false);
  });
});
