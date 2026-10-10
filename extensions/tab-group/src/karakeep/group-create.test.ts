import { describe, expect, it } from 'vitest';
import { buildGroupCreateBody } from './group-create';
import { parseGroupDescription } from './group-metadata';

const GROUP = {
  name: '2026-08-28 15:00 (12 tabs)',
  parentId: 'parent-1',
  tabCount: 12,
  savedAt: '2026-08-28T06:00:00.000Z',
};

describe('buildGroupCreateBody', () => {
  // The regression this pins: the create body omitted description, so savedAt was null on
  // every group the extension made and only rename or open ever filled it in.
  it('carries a description', () => {
    expect(buildGroupCreateBody(GROUP).description).toBeTruthy();
  });

  it('round-trips the metadata the description is meant to carry', () => {
    const meta = parseGroupDescription(buildGroupCreateBody(GROUP).description);
    expect(meta.tabCount).toBe(12);
    expect(meta.savedAt).toBe('2026-08-28T06:00:00.000Z');
    expect(meta.lastOpenedAt).toBeNull();
  });

  it('sends the fields the API requires', () => {
    const body = buildGroupCreateBody(GROUP);
    expect(body.name).toBe(GROUP.name);
    expect(body.parentId).toBe('parent-1');
    expect(body.type).toBe('manual');
    // icon is required by createList, not optional
    expect(body.icon).toBeTruthy();
  });
});
