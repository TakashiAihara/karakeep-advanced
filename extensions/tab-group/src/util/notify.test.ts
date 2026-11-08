import { describe, expect, it } from 'vitest';
import { describeSaveResult } from './notify';
import type { SaveResult } from '@/src/messaging/schema';

function result(over: Partial<SaveResult> = {}): SaveResult {
  return {
    jobId: 'job-1',
    subListId: 'list-1',
    subListName: '2026-08-28 15:00 (3 tabs)',
    totalCount: 3,
    savedCount: 3,
    failed: [],
    closeAfter: false,
    closedTabs: 0,
    ...over,
  };
}

describe('describeSaveResult', () => {
  it('reports the count and the group name', () => {
    expect(describeSaveResult(result())).toBe('Saved 3/3 → 2026-08-28 15:00 (3 tabs)');
  });

  it('reports failures', () => {
    const text = describeSaveResult(
      result({ savedCount: 2, failed: [{ url: 'https://a', reason: 'HTTP 500' }] }),
    );
    expect(text).toContain('1 failed');
  });

  // The bug this pins: intent used to be inferred from closedTabs, so a save that never
  // intended to close anything claimed the tabs were "left open so you can retry".
  it('does not mention leaving tabs open when closing was never requested', () => {
    const text = describeSaveResult(
      result({
        closeAfter: false,
        savedCount: 0,
        totalCount: 1,
        failed: [{ url: 'https://a', reason: 'HTTP 500' }],
      }),
    );
    expect(text).toContain('1 failed');
    expect(text).not.toContain('left open');
    expect(text).not.toContain('closed');
  });

  it('explains why the window is untouched when a requested close was skipped', () => {
    const text = describeSaveResult(
      result({ closeAfter: true, savedCount: 2, failed: [{ url: 'https://a', reason: 'x' }] }),
    );
    expect(text).toContain('tabs left open so you can retry');
  });

  it('reports a clean full close', () => {
    expect(describeSaveResult(result({ closeAfter: true, closedTabs: 3 }))).toContain(
      'closed 3',
    );
  });

  // The other half: a close was asked for and succeeded, but some tabs had drifted away.
  // Reporting only "closed 2" would leave the survivor unexplained.
  it('names the shortfall when fewer tabs closed than were saved', () => {
    const text = describeSaveResult(result({ closeAfter: true, closedTabs: 2 }));
    expect(text).toContain('closed 2 of 3');
  });

  it('names the shortfall even when nothing closed at all', () => {
    const text = describeSaveResult(result({ closeAfter: true, closedTabs: 0 }));
    expect(text).toContain('closed 0 of 3');
  });
});
