import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import SearchPanel from './components/SearchPanel';
import { sendRequest } from '@/src/messaging/send';
import type { SaveResult } from '@/src/messaging/schema';
import { apiKeyItem, serverUrlItem } from '@/src/storage/items';
import './App.css';

type View = 'save' | 'search';

type SaveUi =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'success'; result: SaveResult; closed: boolean }
  | { kind: 'error'; message: string };

type ReadyState =
  | { kind: 'loading' }
  | { kind: 'unconfigured' }
  | { kind: 'ready'; tabCount: number };

function isSaveable(tab: { url?: string }): boolean {
  return typeof tab.url === 'string' && /^https?:\/\//i.test(tab.url);
}

export default function App() {
  const [view, setView] = useState<View>('save');
  const [ready, setReady] = useState<ReadyState>({ kind: 'loading' });
  const [save, setSave] = useState<SaveUi>({ kind: 'idle' });

  useEffect(() => {
    void (async () => {
      const [serverUrl, apiKey, tabs] = await Promise.all([
        serverUrlItem.getValue(),
        apiKeyItem.getValue(),
        browser.tabs.query({ currentWindow: true }),
      ]);
      if (!serverUrl || !apiKey) {
        setReady({ kind: 'unconfigured' });
        return;
      }
      setReady({ kind: 'ready', tabCount: tabs.filter(isSaveable).length });
    })();
  }, []);

  async function runSave(close: boolean) {
    setSave({ kind: 'saving' });
    const response = await sendRequest(
      close
        ? { type: 'SAVE_AND_CLOSE', scope: 'all' }
        : { type: 'SAVE_WITHOUT_CLOSING', scope: 'all' },
    );
    if (response.type === 'SAVED') {
      setSave({ kind: 'success', result: response.result, closed: close });
      return;
    }
    setSave({ kind: 'error', message: response.message });
  }

  if (ready.kind === 'loading') {
    return (
      <main className="popup">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  if (ready.kind === 'unconfigured') {
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

      <nav className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'save'}
          className={view === 'save' ? 'tab active' : 'tab'}
          onClick={() => setView('save')}
        >
          Save
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'search'}
          className={view === 'search' ? 'tab active' : 'tab'}
          onClick={() => setView('search')}
        >
          Search
        </button>
      </nav>

      {view === 'save' && (
        <>
          <p className="count">
            {ready.tabCount} saveable tab{ready.tabCount === 1 ? '' : 's'} in this window
          </p>
          <div className="actions">
            <button
              type="button"
              onClick={() => runSave(true)}
              disabled={save.kind === 'saving' || ready.tabCount === 0}
            >
              {save.kind === 'saving' ? 'Saving…' : 'Save & close all'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => runSave(false)}
              disabled={save.kind === 'saving' || ready.tabCount === 0}
            >
              Save without closing
            </button>
          </div>
          {save.kind === 'success' && (
            <div className="status success">
              Saved {save.result.savedCount}/{save.result.totalCount} to&nbsp;
              <strong>{save.result.subListName}</strong>
              {save.result.failed.length > 0 && (
                <span className="warn"> · {save.result.failed.length} failed</span>
              )}
              {save.closed && save.result.closedTabs > 0 && (
                <span className="muted"> · closed {save.result.closedTabs}</span>
              )}
            </div>
          )}
          {save.kind === 'error' && <div className="status error">{save.message}</div>}
        </>
      )}

      {view === 'search' && <SearchPanel />}
    </main>
  );
}
