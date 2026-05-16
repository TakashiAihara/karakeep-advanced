import type { SaveScope } from '@/src/messaging/schema';

export type CandidateTab = {
  url?: string;
  pinned?: boolean;
  active?: boolean;
  highlighted?: boolean;
};

export function isSaveableTabUrl(url: string | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

export function selectSaveableTabs<T extends CandidateTab>(
  tabs: readonly T[],
  scope: SaveScope,
  options: { excludePinned: boolean },
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
  return filtered;
}
