import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { sendRequest } from '@/src/messaging/send';
import type { SaveResult } from '@/src/messaging/schema';
import { apiKeyItem, serverUrlItem } from '@/src/storage/items';
import './App.css';

type Ui =
  | { kind: 'loading' }
  | { kind: 'unconfigured' }
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'success'; result: SaveResult; closed: boolean }
  | { kind: 'error'; message: string };

function isSaveable(tab: { url?: string }): boolean {
  return typeof tab.url === 'string' && /^https?:\/\//i.test(tab.url);
}

export default function App() {
  const [tabCount, setTabCount] = useState(0);
  const [ui, setUi] = useState<Ui>({ kind: 'loading' });

  useEffect(() => {
    void (async () => {
      const [serverUrl, apiKey, tabs] = await Promise.all([
        serverUrlItem.getValue(),
        apiKeyItem.getValue(),
        browser.tabs.query({ currentWindow: true }),
      ]);
      const count = tabs.filter(isSaveable).length;
      setTabCount(count);
      if (!serverUrl || !apiKey) {
        setUi({ kind: 'unconfigured' });
        return;
      }
      setUi({ kind: 'idle' });
    })();
  }, []);

  async function save(close: boolean) {
    setUi({ kind: 'saving' });
    const response = await sendRequest(
      close
        ? { type: 'SAVE_AND_CLOSE', scope: 'all' }
        : { type: 'SAVE_WITHOUT_CLOSING', scope: 'all' },
    );
    if (response.type === 'SAVED') {
      setUi({ kind: 'success', result: response.result, closed: close });
      return;
    }
    setUi({ kind: 'error', message: response.message });
  }

  if (ui.kind === 'loading') {
    return (
      <main className="popup">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (ui.kind === 'unconfigured') {
    return (
      <main className="popup">
        <h1>Karakeep Advanced</h1>
        <p>Configure your Karakeep server URL and API key first.</p>
        <button onClick={() => browser.runtime.openOptionsPage()}>Open Options</button>
      </main>
    );
  }

  return (
    <main className="popup">
      <header>
        <h1>Karakeep Advanced</h1>
        <button
          type="button"
          className="link"
          onClick={() => browser.runtime.openOptionsPage()}
          aria-label="Open options"
        >
          ⚙
        </button>
      </header>

      <p className="count">
        {tabCount} saveable tab{tabCount === 1 ? '' : 's'} in this window
      </p>

      <div className="actions">
        <button
          type="button"
          onClick={() => save(true)}
          disabled={ui.kind === 'saving' || tabCount === 0}
        >
          {ui.kind === 'saving' ? 'Saving…' : 'Save & close all'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => save(false)}
          disabled={ui.kind === 'saving' || tabCount === 0}
        >
          Save without closing
        </button>
      </div>

      {ui.kind === 'success' && (
        <div className="status success">
          Saved {ui.result.savedCount}/{ui.result.totalCount} to&nbsp;
          <strong>{ui.result.subListName}</strong>
          {ui.result.failed.length > 0 && (
            <span className="warn"> · {ui.result.failed.length} failed</span>
          )}
          {ui.closed && ui.result.closedTabs > 0 && (
            <span className="muted"> · closed {ui.result.closedTabs}</span>
          )}
        </div>
      )}

      {ui.kind === 'error' && <div className="status error">{ui.message}</div>}
    </main>
  );
}
