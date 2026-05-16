export type OneTabEntry = {
  url: string;
  title: string | undefined;
};

export type OneTabGroup = {
  entries: OneTabEntry[];
};

const DELIMITER = ' | ';

function parseLine(line: string): OneTabEntry | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const sepIdx = trimmed.indexOf(DELIMITER);
  const url = sepIdx === -1 ? trimmed : trimmed.slice(0, sepIdx).trim();
  const title = sepIdx === -1 ? undefined : trimmed.slice(sepIdx + DELIMITER.length).trim();

  if (!/^https?:\/\//i.test(url)) return null;
  return { url, title: title || undefined };
}

export function parseOneTabExport(text: string): OneTabGroup[] {
  const groups: OneTabGroup[] = [];
  let current: OneTabEntry[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.trim() === '') {
      if (current.length > 0) {
        groups.push({ entries: current });
        current = [];
      }
      continue;
    }
    const entry = parseLine(rawLine);
    if (entry) current.push(entry);
  }

  if (current.length > 0) groups.push({ entries: current });
  return groups;
}
