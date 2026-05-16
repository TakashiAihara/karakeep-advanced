import type { SaveScope } from '@/src/messaging/schema';

export type CandidateTab = {
  id?: number;
  url?: string;
  pinned?: boolean;
  active?: boolean;
  highlighted?: boolean;
};

export type SelectOptions = {
  excludePinned: boolean;
  tabIds?: number[];
};

export function isSaveableTabUrl(url: string | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

export function selectSaveableTabs<T extends CandidateTab>(
  tabs: readonly T[],
  scope: SaveScope,
  options: SelectOptions,
): T[] {
  const filtered = tabs
    .filter((t) => isSaveableTabUrl(t.url))
    .filter((t) => !options.excludePinned || !t.pinned);

  if (scope === 'all') return filtered;
  if (scope === 'others') return filtered.filter((t) => !t.active);
  if (scope === 'selected') {
    const highlighted = filtered.filter((t) => t.highlighted);
    return highlighted.length > 0 ? highlighted : filtered.filter((t) => t.active);
  }
  if (scope === 'single') {
    const wanted = options.tabIds ?? [];
    if (wanted.length === 0) return [];
    const lookup = new Set(wanted);
    return filtered.filter((t) => t.id != null && lookup.has(t.id));
  }
  return filtered;
}
