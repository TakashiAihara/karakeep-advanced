import { useState, type ChangeEvent } from 'react';
import { sendRequest } from '@/src/messaging/send';
import type { ImportSummary } from '@/src/messaging/schema';
import { parseOneTabExport } from '@/src/parsers/one-tab-export';

type Ui =
  | { kind: 'idle' }
  | { kind: 'importing' }
  | { kind: 'done'; summary: ImportSummary }
  | { kind: 'error'; message: string };

export default function ImportPanel() {
  const [text, setText] = useState('');
  const [ui, setUi] = useState<Ui>({ kind: 'idle' });

  const preview = text.trim() ? parseOneTabExport(text) : [];
  const totalEntries = preview.reduce((acc, g) => acc + g.entries.length, 0);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setText(await file.text());
  }

  async function runImport() {
    if (!text.trim()) return;
    setUi({ kind: 'importing' });
    const response = await sendRequest({ type: 'IMPORT_ONETAB', text });
    if (response.type === 'IMPORTED') {
      setUi({ kind: 'done', summary: response.summary });
      return;
    }
    setUi({ kind: 'error', message: response.message });
  }

  return (
    <div className="import">
      <label className="muted import-file">
        Or load a .txt file:
        <input type="file" accept=".txt,text/plain" onChange={handleFile} />
      </label>

      <textarea
        className="import-textarea"
        placeholder={`Paste a OneTab export here, e.g.\n\nhttps://example.com | Example\nhttps://github.com | GitHub\n\nhttps://...`}
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="row">
        <button
          type="button"
          onClick={runImport}
          disabled={ui.kind === 'importing' || preview.length === 0}
        >
          {ui.kind === 'importing'
            ? 'Importing…'
            : preview.length > 0
              ? `Import ${preview.length} group${preview.length === 1 ? '' : 's'} (${totalEntries} URLs)`
              : 'Import'}
        </button>
      </div>

      {ui.kind === 'done' && (
        <div className="status success">
          Imported {ui.summary.groupsImported} group
          {ui.summary.groupsImported === 1 ? '' : 's'} ·&nbsp;
          {ui.summary.bookmarksCreated} bookmarks
          {ui.summary.failed.length > 0 && (
            <span className="warn"> · {ui.summary.failed.length} failed</span>
          )}
        </div>
      )}
      {ui.kind === 'error' && <div className="status error">{ui.message}</div>}
    </div>
  );
}
