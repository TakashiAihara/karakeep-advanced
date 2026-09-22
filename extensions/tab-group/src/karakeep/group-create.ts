import { formatGroupDescription } from './group-metadata';

export const SUB_LIST_ICON = '📑';

export type NewGroup = {
  name: string;
  parentId: string;
  tabCount: number;
  savedAt: string;
};

/**
 * The body for creating one tab group.
 *
 * Exists as its own module so the description can be pinned by a test. It was previously
 * built inline and omitted description entirely, which left savedAt null on every group the
 * extension ever created — the field the two-line format exists to carry, and the only
 * ordering key that survives moving between machines.
 */
export function buildGroupCreateBody(group: NewGroup) {
  return {
    name: group.name,
    description: formatGroupDescription({
      v: 1,
      tabCount: group.tabCount,
      savedAt: group.savedAt,
      lastOpenedAt: null,
    }),
    icon: SUB_LIST_ICON,
    type: 'manual' as const,
    parentId: group.parentId,
  };
}
