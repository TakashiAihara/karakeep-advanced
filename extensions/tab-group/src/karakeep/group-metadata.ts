// Metadata lives in `List.description`, not the name: renaming must not destroy the tab
// count (D06, #22). Only the `<!-- ka:` line is parsed; line 1 is prose for Karakeep's UI.

export type GroupMetadata = {
  v: 1;
  tabCount: number | null;
  savedAt: string | null;
  lastOpenedAt: string | null;
};

const MARKER_PATTERN = /^<!--\s*ka:(.*)-->$/;
const LEGACY_TAB_COUNT_PATTERN = /\((\d+)\s*tabs?\)\s*$/;

const MAX_DESCRIPTION_CHARS = 8192;
const MAX_MARKER_PAYLOAD_CHARS = 2048;
const MAX_TIMESTAMP_CHARS = 64;
const LEGACY_NAME_TAIL_CHARS = 256;

function emptyMetadata(): GroupMetadata {
  return { v: 1, tabCount: null, savedAt: null, lastOpenedAt: null };
}

function normalizeTabCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 0 || value > Number.MAX_SAFE_INTEGER) return null;
  return value;
}

// Normalizing to ISO is also what keeps `-->` and newlines out of the marker payload.
function normalizeTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (value.length === 0 || value.length > MAX_TIMESTAMP_CHARS) return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Minutes east of UTC for the machine writing the description. */
export function localOffsetMinutes(at: Date): number {
  return -at.getTimezoneOffset();
}

/**
 * Render an instant for the human line, tagged with the offset it is rendered in.
 *
 * The description is written once by whichever machine performed the save and then read
 * verbatim by every other one, so a bare local clock is not merely imprecise: the same
 * instant renders a calendar day apart between Asia/Tokyo and America/Los_Angeles, and the
 * reader has no way to tell which machine's day it is looking at. The offset is what makes
 * the line answerable. The JSON line remains the authoritative instant.
 */
export function formatClock(iso: string, offsetMinutes: number): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const shifted = new Date(at.getTime() + offsetMinutes * 60_000);
  const date = `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(
    shifted.getUTCDate(),
  )}`;
  const clock = `${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;

  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const zone = `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;

  return `${date} ${clock} ${zone}`;
}

export function formatGroupDescription(
  meta: GroupMetadata,
  offsetMinutes: number = localOffsetMinutes(new Date()),
): string {
  const tabCount = normalizeTabCount(meta?.tabCount);
  const savedAt = normalizeTimestamp(meta?.savedAt);
  const lastOpenedAt = normalizeTimestamp(meta?.lastOpenedAt);

  const parts: string[] = [];
  if (tabCount !== null) parts.push(`${tabCount} ${tabCount === 1 ? 'tab' : 'tabs'}`);
  if (savedAt !== null) parts.push(`saved ${formatClock(savedAt, offsetMinutes)}`);

  const payload = JSON.stringify({ v: 1, tabCount, savedAt, lastOpenedAt });
  const marker = `<!-- ka:${payload} -->`;
  return parts.length > 0 ? `${parts.join(' · ')}\n${marker}` : marker;
}

function parseMarkerLine(line: string | undefined): GroupMetadata | null {
  if (typeof line !== 'string') return null;
  const match = line.trim().match(MARKER_PATTERN);
  if (!match) return null;

  const payload = (match[1] ?? '').trim();
  if (payload.length === 0 || payload.length > MAX_MARKER_PAYLOAD_CHARS) return null;

  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;

  const record = data as Record<string, unknown>;
  if (record.v !== 1) return null;

  return {
    v: 1,
    tabCount: normalizeTabCount(record.tabCount),
    savedAt: normalizeTimestamp(record.savedAt),
    lastOpenedAt: normalizeTimestamp(record.lastOpenedAt),
  };
}

export function parseGroupDescription(
  description: string | null | undefined,
): GroupMetadata {
  if (typeof description !== 'string' || description.length === 0) return emptyMetadata();

  const scanned =
    description.length > MAX_DESCRIPTION_CHARS
      ? description.slice(-MAX_DESCRIPTION_CHARS)
      : description;

  // Scanned newest-first: a writer that appends without pruning leaves the live marker last.
  const lines = scanned.split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const parsed = parseMarkerLine(lines[i]);
    if (parsed !== null) return parsed;
  }
  return emptyMetadata();
}

export function parseLegacyTabCount(name: string | null | undefined): number | null {
  if (typeof name !== 'string' || name.length === 0) return null;

  const tail =
    name.length > LEGACY_NAME_TAIL_CHARS ? name.slice(-LEGACY_NAME_TAIL_CHARS) : name;
  const match = tail.match(LEGACY_TAB_COUNT_PATTERN);
  if (!match) return null;
  return normalizeTabCount(Number(match[1]));
}

export function readGroupMetadata(
  name: string | null | undefined,
  description: string | null | undefined,
): GroupMetadata {
  const meta = parseGroupDescription(description);
  if (meta.tabCount !== null) return meta;
  return { ...meta, tabCount: parseLegacyTabCount(name) };
}
