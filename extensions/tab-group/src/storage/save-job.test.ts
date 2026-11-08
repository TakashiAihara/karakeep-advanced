import { describe, expect, it } from 'vitest';
import { isJobStale, SAVE_JOB_MAX_AGE_MS } from '@/src/storage/save-job';

const NOW = Date.parse('2026-08-28T12:00:00.000Z');

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString();
}

describe('isJobStale', () => {
  it('keeps a job that just started', () => {
    expect(isJobStale(ago(0), NOW)).toBe(false);
  });

  it('keeps a job just inside the window', () => {
    expect(isJobStale(ago(SAVE_JOB_MAX_AGE_MS - 1000), NOW)).toBe(false);
  });

  it('keeps a job exactly at the window edge', () => {
    expect(isJobStale(ago(SAVE_JOB_MAX_AGE_MS), NOW)).toBe(false);
  });

  it('drops a job past the window', () => {
    expect(isJobStale(ago(SAVE_JOB_MAX_AGE_MS + 1), NOW)).toBe(true);
  });

  it('drops a job from days ago', () => {
    expect(isJobStale(ago(7 * 24 * 60 * 60 * 1000), NOW)).toBe(true);
  });

  // A job whose age cannot be established is not one to act on.
  it.each(['', 'not a date', '2026-13-45T99:99:99Z'])(
    'treats the unparseable timestamp %j as stale',
    (value) => {
      expect(isJobStale(value, NOW)).toBe(true);
    },
  );

  // Clock skew between the machine that wrote the job and the one reading it would
  // otherwise make a future timestamp look infinitely fresh, which is the safe side.
  it('keeps a job with a future timestamp rather than discarding it', () => {
    expect(isJobStale(new Date(NOW + 60_000).toISOString(), NOW)).toBe(false);
  });
});
