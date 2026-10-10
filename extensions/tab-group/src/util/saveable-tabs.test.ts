import { describe, expect, it } from 'vitest';
import type { SaveScope } from '@/src/messaging/schema';
import type { CandidateTab } from './saveable-tabs';
import { isSaveableTabUrl, selectSaveableTabs } from './saveable-tabs';

type TestTab = {
  id: number;
  url?: string;
  pinned?: boolean;
  active?: boolean;
  highlighted?: boolean;
  windowId?: number;
};

const ALL_SCOPES: SaveScope[] = ['all', 'others', 'selected', 'single'];

function ids(tabs: readonly TestTab[]): number[] {
  return tabs.map((t) => t.id);
}

describe('isSaveableTabUrl', () => {
  it('accepts http and https regardless of case', () => {
    expect(isSaveableTabUrl('http://example.com')).toBe(true);
    expect(isSaveableTabUrl('https://example.com')).toBe(true);
    expect(isSaveableTabUrl('HTTPS://example.com')).toBe(true);
  });

  it('rejects a missing url', () => {
    expect(isSaveableTabUrl(undefined)).toBe(false);
  });

  it('rejects every other scheme', () => {
    const urls = [
      'chrome://extensions',
      'chrome-extension://abc/popup.html',
      'about:blank',
      'file:///tmp/a.html',
      'javascript:void(0)',
      'ftp://example.com',
      'data:text/html,hi',
      'view-source:https://example.com',
    ];
    for (const url of urls) {
      expect(isSaveableTabUrl(url)).toBe(false);
    }
  });

  it('anchors the scheme at the start of the string', () => {
    expect(isSaveableTabUrl(' https://example.com')).toBe(false);
    expect(isSaveableTabUrl('https:/example.com')).toBe(false);
  });
});

describe('selectSaveableTabs', () => {
  it('drops non-http(s) urls in every scope', () => {
    const unsaveable: TestTab[] = [
      { id: 1, url: 'chrome://extensions', active: true, highlighted: true },
      { id: 2, url: 'about:blank' },
      { id: 3, url: undefined, highlighted: true },
    ];
    const saveable: TestTab[] = unsaveable.map((t, i) => ({
      ...t,
      url: `https://example.com/${i}`,
    }));
    const options = { excludePinned: false, tabIds: [1, 2, 3] };

    for (const scope of ALL_SCOPES) {
      expect(selectSaveableTabs(unsaveable, scope, options)).toEqual([]);
      expect(selectSaveableTabs(saveable, scope, options).length).toBeGreaterThan(0);
    }
  });

  it('returns every saveable tab in input order for scope all', () => {
    const tabs: TestTab[] = [
      { id: 1, url: 'https://a.example' },
      { id: 2, url: 'chrome://extensions' },
      { id: 3, url: 'https://b.example', active: true },
      { id: 4, url: 'https://c.example', pinned: true },
    ];
    expect(ids(selectSaveableTabs(tabs, 'all', { excludePinned: false }))).toEqual([1, 3, 4]);
  });

  it('drops pinned tabs only when excludePinned is true', () => {
    const tabs: TestTab[] = [
      { id: 1, url: 'https://a.example' },
      { id: 2, url: 'https://b.example', pinned: true },
    ];
    expect(ids(selectSaveableTabs(tabs, 'all', { excludePinned: true }))).toEqual([1]);
    expect(ids(selectSaveableTabs(tabs, 'all', { excludePinned: false }))).toEqual([1, 2]);
  });

  it('scope others drops the active tab and keeps everything else', () => {
    const tabs: TestTab[] = [
      { id: 1, url: 'https://a.example' },
      { id: 2, url: 'https://b.example', active: true },
      { id: 3, url: 'https://c.example' },
    ];
    expect(ids(selectSaveableTabs(tabs, 'others', { excludePinned: false }))).toEqual([1, 3]);
  });

  it('scope others filters on the active flag, not on the window', () => {
    const tabs: TestTab[] = [
      { id: 1, url: 'https://a.example', active: true, windowId: 1 },
      { id: 2, url: 'https://b.example', windowId: 1 },
      { id: 3, url: 'https://c.example', active: true, windowId: 2 },
      { id: 4, url: 'https://d.example', windowId: 2 },
    ];
    expect(ids(selectSaveableTabs(tabs, 'others', { excludePinned: false }))).toEqual([2, 4]);
  });

  it('scope selected returns the highlighted tabs', () => {
    const tabs: TestTab[] = [
      { id: 1, url: 'https://a.example', highlighted: true, active: true },
      { id: 2, url: 'https://b.example' },
      { id: 3, url: 'https://c.example', highlighted: true },
    ];
    expect(ids(selectSaveableTabs(tabs, 'selected', { excludePinned: false }))).toEqual([1, 3]);
  });

  it('scope selected falls back to the active tab when nothing is highlighted', () => {
    const tabs: TestTab[] = [
      { id: 1, url: 'https://a.example' },
      { id: 2, url: 'https://b.example', active: true },
    ];
    expect(ids(selectSaveableTabs(tabs, 'selected', { excludePinned: false }))).toEqual([2]);
  });

  it('scope selected returns empty when nothing is highlighted and nothing is active', () => {
    const tabs: TestTab[] = [
      { id: 1, url: 'https://a.example' },
      { id: 2, url: 'https://b.example' },
    ];
    expect(selectSaveableTabs(tabs, 'selected', { excludePinned: false })).toEqual([]);
  });

  it('scope single returns empty when tabIds is missing or empty', () => {
    const tabs: TestTab[] = [
      { id: 1, url: 'https://a.example', active: true, highlighted: true },
    ];
    expect(selectSaveableTabs(tabs, 'single', { excludePinned: false })).toEqual([]);
    expect(selectSaveableTabs(tabs, 'single', { excludePinned: false, tabIds: [] })).toEqual([]);
  });

  it('scope single matches by tab id and ignores unknown ids', () => {
    const tabs: TestTab[] = [
      { id: 1, url: 'https://a.example' },
      { id: 2, url: 'https://b.example' },
      { id: 3, url: 'https://c.example' },
    ];
    const selected = selectSaveableTabs(tabs, 'single', {
      excludePinned: false,
      tabIds: [3, 1, 99],
    });
    expect(ids(selected)).toEqual([1, 3]);
  });

  it('scope single never matches a tab that has no id', () => {
    const tabs: CandidateTab[] = [{ url: 'https://a.example' }];
    expect(selectSaveableTabs(tabs, 'single', { excludePinned: false, tabIds: [1] })).toEqual([]);
  });

  it('applies the pinned exclusion before the scope filter', () => {
    const activePinned: TestTab[] = [
      { id: 1, url: 'https://a.example', active: true, pinned: true },
      { id: 2, url: 'https://b.example' },
    ];
    expect(selectSaveableTabs(activePinned, 'selected', { excludePinned: true })).toEqual([]);
    expect(ids(selectSaveableTabs(activePinned, 'selected', { excludePinned: false }))).toEqual([1]);
    expect(selectSaveableTabs(activePinned, 'single', { excludePinned: true, tabIds: [1] })).toEqual(
      [],
    );

    const highlightedPinned: TestTab[] = [
      { id: 1, url: 'https://a.example', highlighted: true, pinned: true },
      { id: 2, url: 'https://b.example', active: true },
    ];
    expect(ids(selectSaveableTabs(highlightedPinned, 'selected', { excludePinned: true }))).toEqual(
      [2],
    );
  });
});
