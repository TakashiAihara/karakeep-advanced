import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatGroupDescription,
  parseGroupDescription,
  parseLegacyTabCount,
  readGroupMetadata,
  type GroupMetadata,
} from '@/src/karakeep/group-metadata';

const EMPTY: GroupMetadata = {
  v: 1,
  tabCount: null,
  savedAt: null,
  lastOpenedAt: null,
};

function marker(payload: string): string {
  return `<!-- ka:${payload} -->`;
}

describe('formatGroupDescription', () => {
  it('writes a human line and a marker line', () => {
    const description = formatGroupDescription(
      {
        v: 1,
        tabCount: 12,
        savedAt: '2026-08-28T06:00:00Z',
        lastOpenedAt: null,
      },
      540,
    );

    const lines = description.split('\n');
    expect(lines).toHaveLength(2);
    // asserted exactly, not by shape: a shape regex here stayed green while the month,
    // the day-of-month and the hour were each corrupted in turn
    expect(lines[0]).toBe('12 tabs · saved 2026-08-28 15:00 +09:00');
    expect(lines[1]).toBe(
      marker('{"v":1,"tabCount":12,"savedAt":"2026-08-28T06:00:00.000Z","lastOpenedAt":null}'),
    );
  });

  it('uses the singular noun for one tab', () => {
    const [human] = formatGroupDescription({ ...EMPTY, tabCount: 1 }).split('\n');
    expect(human).toBe('1 tab');
  });

  it('emits only the marker line when there is nothing to show a human', () => {
    expect(formatGroupDescription(EMPTY)).toBe(
      marker('{"v":1,"tabCount":null,"savedAt":null,"lastOpenedAt":null}'),
    );
  });

  it('drops values that would corrupt the marker line', () => {
    const description = formatGroupDescription({
      v: 1,
      tabCount: -3,
      savedAt: '--> not a date',
      lastOpenedAt: 'first\nsecond',
    } as GroupMetadata);

    expect(description).toBe(
      marker('{"v":1,"tabCount":null,"savedAt":null,"lastOpenedAt":null}'),
    );
    expect(description.split('\n')).toHaveLength(1);
  });
});

describe('round trip', () => {
  it('recovers every field', () => {
    const meta: GroupMetadata = {
      v: 1,
      tabCount: 7,
      savedAt: '2026-08-28T06:00:00.000Z',
      lastOpenedAt: '2026-08-29T01:02:03.000Z',
    };
    expect(parseGroupDescription(formatGroupDescription(meta))).toEqual(meta);
  });

  it('is idempotent once normalized', () => {
    const once = formatGroupDescription({
      v: 1,
      tabCount: 3,
      savedAt: '2026-08-28',
      lastOpenedAt: null,
    });
    expect(formatGroupDescription(parseGroupDescription(once))).toBe(once);
  });

  it('survives a zero tab count', () => {
    expect(parseGroupDescription(formatGroupDescription({ ...EMPTY, tabCount: 0 }))).toEqual({
      ...EMPTY,
      tabCount: 0,
    });
  });
});

describe('parseGroupDescription', () => {
  it('degrades to nulls for absent input', () => {
    expect(parseGroupDescription(null)).toEqual(EMPTY);
    expect(parseGroupDescription(undefined)).toEqual(EMPTY);
    expect(parseGroupDescription('')).toEqual(EMPTY);
  });

  it('degrades to nulls for a description written by a human', () => {
    expect(parseGroupDescription('Reading list for the weekend')).toEqual(EMPTY);
  });

  it('never parses the human line', () => {
    expect(parseGroupDescription('12 tabs · saved 2026-08-28 15:00')).toEqual(EMPTY);
  });

  it('degrades to nulls for malformed JSON', () => {
    expect(parseGroupDescription(marker('{"v":1,'))).toEqual(EMPTY);
    expect(parseGroupDescription(marker('not json at all'))).toEqual(EMPTY);
    expect(parseGroupDescription(marker(''))).toEqual(EMPTY);
  });

  it('rejects JSON that is not an object', () => {
    expect(parseGroupDescription(marker('null'))).toEqual(EMPTY);
    expect(parseGroupDescription(marker('[{"v":1,"tabCount":9}]'))).toEqual(EMPTY);
    expect(parseGroupDescription(marker('42'))).toEqual(EMPTY);
    expect(parseGroupDescription(marker('"v1"'))).toEqual(EMPTY);
    expect(parseGroupDescription(marker('true'))).toEqual(EMPTY);
  });

  it('rejects an unknown version', () => {
    expect(parseGroupDescription(marker('{"v":2,"tabCount":9}'))).toEqual(EMPTY);
    expect(parseGroupDescription(marker('{"v":"1","tabCount":9}'))).toEqual(EMPTY);
    expect(parseGroupDescription(marker('{"tabCount":9}'))).toEqual(EMPTY);
  });

  it('rejects a tab count that is not a whole non-negative number', () => {
    expect(parseGroupDescription(marker('{"v":1,"tabCount":"12"}')).tabCount).toBeNull();
    expect(parseGroupDescription(marker('{"v":1,"tabCount":-1}')).tabCount).toBeNull();
    expect(parseGroupDescription(marker('{"v":1,"tabCount":1.5}')).tabCount).toBeNull();
    expect(parseGroupDescription(marker('{"v":1,"tabCount":null}')).tabCount).toBeNull();
    expect(parseGroupDescription(marker('{"v":1,"tabCount":1e21}')).tabCount).toBeNull();
  });

  it('rejects timestamps it cannot read', () => {
    const meta = parseGroupDescription(
      marker('{"v":1,"tabCount":1,"savedAt":"yesterday","lastOpenedAt":123}'),
    );
    expect(meta.savedAt).toBeNull();
    expect(meta.lastOpenedAt).toBeNull();
    expect(meta.tabCount).toBe(1);
  });

  it('keeps the last marker when several are present', () => {
    const description = [
      marker('{"v":1,"tabCount":1}'),
      marker('{"v":1,"tabCount":2}'),
      marker('{"v":1,"tabCount":3}'),
    ].join('\n');
    expect(parseGroupDescription(description).tabCount).toBe(3);
  });

  it('falls back to an earlier marker when the last one is broken', () => {
    const description = [marker('{"v":1,"tabCount":4}'), marker('{"v":1,')].join('\n');
    expect(parseGroupDescription(description).tabCount).toBe(4);
  });

  it('tolerates CRLF and surrounding whitespace', () => {
    const description = `8 tabs\r\n   ${marker('{"v":1,"tabCount":8}')}   `;
    expect(parseGroupDescription(description).tabCount).toBe(8);
  });

  it('reads a marker at the end of an extremely long description', () => {
    const description = `${'x'.repeat(1_000_000)}\n${marker('{"v":1,"tabCount":5}')}`;
    expect(parseGroupDescription(description).tabCount).toBe(5);
  });

  it('ignores a marker that sits beyond the scanned tail', () => {
    const description = `${marker('{"v":1,"tabCount":6}')}\n${'x'.repeat(1_000_000)}`;
    expect(parseGroupDescription(description)).toEqual(EMPTY);
  });

  it('ignores an oversized marker payload', () => {
    const padded = `{"v":1,"tabCount":7,"pad":"${'a'.repeat(3000)}"}`;
    expect(parseGroupDescription(marker(padded))).toEqual(EMPTY);
  });

  it('does not throw on extremely long junk', () => {
    expect(parseGroupDescription('y'.repeat(1_000_000))).toEqual(EMPTY);
    expect(parseGroupDescription(marker(`{"v":1,"tabCount":${'9'.repeat(5000)}}`))).toEqual(
      EMPTY,
    );
  });
});

describe('parseLegacyTabCount', () => {
  it('reads the old name convention', () => {
    expect(parseLegacyTabCount('Work (12 tabs)')).toBe(12);
    expect(parseLegacyTabCount('Work (1 tab)')).toBe(1);
    expect(parseLegacyTabCount('Work (12 tabs)  ')).toBe(12);
  });

  it('returns null for a renamed group', () => {
    expect(parseLegacyTabCount('Work')).toBeNull();
    expect(parseLegacyTabCount('(12 tabs) leftovers')).toBeNull();
    expect(parseLegacyTabCount(null)).toBeNull();
    expect(parseLegacyTabCount(undefined)).toBeNull();
    expect(parseLegacyTabCount('')).toBeNull();
  });

  it('rejects a count too large to be real', () => {
    expect(parseLegacyTabCount(`Work (${'9'.repeat(30)} tabs)`)).toBeNull();
  });
});

describe('readGroupMetadata', () => {
  it('prefers the description over the name', () => {
    const meta = readGroupMetadata('Work (12 tabs)', marker('{"v":1,"tabCount":3}'));
    expect(meta.tabCount).toBe(3);
  });

  it('falls back to the name when the description carries no marker', () => {
    expect(readGroupMetadata('Work (12 tabs)', null).tabCount).toBe(12);
    expect(readGroupMetadata('Work (12 tabs)', 'just prose').tabCount).toBe(12);
  });

  it('falls back to the name when the marker has no usable count', () => {
    const meta = readGroupMetadata(
      'Work (12 tabs)',
      marker('{"v":1,"tabCount":null,"savedAt":"2026-08-28T06:00:00Z"}'),
    );
    expect(meta.tabCount).toBe(12);
    expect(meta.savedAt).toBe('2026-08-28T06:00:00.000Z');
  });

  it('returns nulls when neither side says anything', () => {
    expect(readGroupMetadata('Work', null)).toEqual(EMPTY);
  });
});

describe('formatClock', () => {
  const INSTANT = '2026-08-28T06:00:00.000Z';

  // The description is written once and read verbatim on every other machine, so the
  // rendered clock has to say which offset it is in. Without the tag, this same instant
  // reads as 2026-08-28 in Tokyo and 2026-08-27 in Los Angeles with nothing to tell them
  // apart. These assert exact strings on purpose: a shape regex passed while the month,
  // the day-of-month and the hour were all corrupted.
  it.each([
    [540, '2026-08-28 15:00 +09:00'],
    [0, '2026-08-28 06:00 +00:00'],
    [-420, '2026-08-27 23:00 -07:00'],
    [330, '2026-08-28 11:30 +05:30'],
    [-210, '2026-08-28 02:30 -03:30'],
  ])('renders %i minutes east of UTC as %s', (offset, expected) => {
    expect(formatClock(INSTANT, offset)).toBe(expected);
  });

  it('crosses the year boundary correctly', () => {
    expect(formatClock('2026-12-31T20:00:00.000Z', 540)).toBe('2027-01-01 05:00 +09:00');
  });

  it('returns an empty string for an unparseable instant rather than "NaN"', () => {
    expect(formatClock('not a date', 540)).toBe('');
  });
});

describe('formatGroupDescription clock rendering', () => {
  it('tags the human line with the offset it was rendered in', () => {
    const text = formatGroupDescription(
      { v: 1, tabCount: 12, savedAt: '2026-08-28T06:00:00.000Z', lastOpenedAt: null },
      540,
    );
    expect(text.split('\n')[0]).toBe('12 tabs · saved 2026-08-28 15:00 +09:00');
  });

  // The machine that renders the human line is not the one that reads it, but the JSON
  // line must be identical either way — that is what makes the round trip offset-proof.
  it('produces the same machine line regardless of the rendering offset', () => {
    const meta = { v: 1, tabCount: 12, savedAt: '2026-08-28T06:00:00.000Z', lastOpenedAt: null } as const;
    const tokyo = formatGroupDescription(meta, 540).split('\n')[1];
    const la = formatGroupDescription(meta, -420).split('\n')[1];
    expect(tokyo).toBe(la);
    expect(parseGroupDescription(formatGroupDescription(meta, -420)).savedAt).toBe(meta.savedAt);
  });
});
