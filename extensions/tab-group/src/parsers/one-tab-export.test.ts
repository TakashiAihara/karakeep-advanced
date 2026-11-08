import { describe, expect, it } from 'vitest';
import { parseOneTabExport } from './one-tab-export';

describe('parseOneTabExport', () => {
  it('splits url and title on the first " | "', () => {
    expect(parseOneTabExport('https://a.example | Example A')).toEqual([
      { entries: [{ url: 'https://a.example', title: 'Example A' }] },
    ]);
  });

  it('keeps later " | " occurrences inside the title', () => {
    expect(parseOneTabExport('https://a.example | Docs | Section | Page')).toEqual([
      { entries: [{ url: 'https://a.example', title: 'Docs | Section | Page' }] },
    ]);
  });

  it('treats a line without the separator as a url with no title', () => {
    expect(parseOneTabExport('https://a.example')).toEqual([
      { entries: [{ url: 'https://a.example', title: undefined }] },
    ]);
  });

  it('requires spaces on both sides of the pipe to split', () => {
    expect(parseOneTabExport('https://a.example |Example A')).toEqual([
      { entries: [{ url: 'https://a.example |Example A', title: undefined }] },
    ]);
  });

  // NOTE: the trailing separator is consumed by the leading trim, so the pipe stays glued to the
  // url and the scheme test still passes. Current behaviour, almost certainly not intended.
  it('leaves a dangling pipe in the url when the title after the separator is empty', () => {
    expect(parseOneTabExport('https://a.example | ')).toEqual([
      { entries: [{ url: 'https://a.example |', title: undefined }] },
    ]);
  });

  it('trims whitespace around the url and the title', () => {
    expect(parseOneTabExport('\t  https://a.example   |   Example A  \t')).toEqual([
      { entries: [{ url: 'https://a.example', title: 'Example A' }] },
    ]);
  });

  it('starts a new group on a blank line', () => {
    const text = ['https://a.example | A', 'https://b.example | B', '', 'https://c.example | C'].join(
      '\n',
    );
    expect(parseOneTabExport(text)).toEqual([
      {
        entries: [
          { url: 'https://a.example', title: 'A' },
          { url: 'https://b.example', title: 'B' },
        ],
      },
      { entries: [{ url: 'https://c.example', title: 'C' }] },
    ]);
  });

  it('collapses consecutive blank lines into a single group break', () => {
    const text = 'https://a.example\n\n\n\nhttps://b.example';
    expect(parseOneTabExport(text)).toEqual([
      { entries: [{ url: 'https://a.example', title: undefined }] },
      { entries: [{ url: 'https://b.example', title: undefined }] },
    ]);
  });

  it('treats a whitespace-only line as a group break', () => {
    const text = 'https://a.example\n   \t \nhttps://b.example';
    expect(parseOneTabExport(text)).toHaveLength(2);
  });

  it('ignores leading and trailing blank lines', () => {
    expect(parseOneTabExport('\n\nhttps://a.example\n\n')).toEqual([
      { entries: [{ url: 'https://a.example', title: undefined }] },
    ]);
  });

  it('handles CRLF line endings', () => {
    const text = 'https://a.example | A\r\n\r\nhttps://b.example | B';
    expect(parseOneTabExport(text)).toEqual([
      { entries: [{ url: 'https://a.example', title: 'A' }] },
      { entries: [{ url: 'https://b.example', title: 'B' }] },
    ]);
  });

  it('drops non-http(s) lines without breaking the surrounding group', () => {
    const text = [
      'https://a.example | A',
      'chrome://extensions | Extensions',
      'file:///tmp/a.html | Local',
      'not a url at all',
      'https://b.example | B',
    ].join('\n');
    expect(parseOneTabExport(text)).toEqual([
      {
        entries: [
          { url: 'https://a.example', title: 'A' },
          { url: 'https://b.example', title: 'B' },
        ],
      },
    ]);
  });

  it('emits no group when every line in it was dropped', () => {
    const text = 'chrome://extensions | Extensions\n\nhttps://b.example | B';
    expect(parseOneTabExport(text)).toEqual([
      { entries: [{ url: 'https://b.example', title: 'B' }] },
    ]);
  });

  it('accepts an uppercase scheme', () => {
    expect(parseOneTabExport('HTTPS://a.example | A')).toEqual([
      { entries: [{ url: 'HTTPS://a.example', title: 'A' }] },
    ]);
  });

  it('returns no groups for empty or whitespace-only input', () => {
    expect(parseOneTabExport('')).toEqual([]);
    expect(parseOneTabExport('   \n\t\n  ')).toEqual([]);
  });
});
