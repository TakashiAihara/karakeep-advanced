import { useEffect, useMemo, useState } from 'react';
import { browser } from 'wxt/browser';
import ImportPanel from './components/ImportPanel';
import RecentGroupsPanel from './components/RecentGroupsPanel';
import SearchPanel from './components/SearchPanel';
import { sendRequest } from '@/src/messaging/send';
import type { SaveResult, SaveScope } from '@/src/messaging/schema';
import { apiKeyItem, excludePinnedItem, serverUrlItem } from '@/src/storage/items';
import { selectSaveableTabs, type CandidateTab } from '@/src/util/saveable-tabs';
import './App.css';

type View = 'save' | 'recent' | 'search' | 'import';

type PopupScope = Exclude<SaveScope, 'single'>;

type SaveUi =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'success'; result: SaveResult; closed: boolean }
  | { kind: 'error'; message: string };

type ReadyState =
  | { kind: 'loading' }
  | { kind: 'unconfigured' }
  | {
      kind: 'ready';
      tabs: CandidateTab[];
      excludePinned: boolean;
    };

const SCOPE_LABELS: Record<PopupScope, string> = {
  all: 'All',
  others: 'Others',
  selected: 'Selected',
};

const SCOPE_ORDER: PopupScope[] = ['all', 'others', 'selected'];

const WORKER_RESTART_MESSAGE =
  'The background worker restarted before it replied, so the result is unknown. The save may have completed — check Recent before saving again.';

function describeFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/message port closed/i.test(raw)) return WORKER_RESTART_MESSAGE;
  return raw || 'Something went wrong.';
}

export default function App() {
  const [view, setView] = useState<View>('save');
  const [ready, setReady] = useState<ReadyState>({ kind: 'loading' });
  const [scope, setScope] = useState<PopupScope>('all');
  const [save, setSave] = useState<SaveUi>({ kind: 'idle' });

  useEffect(() => {
    void (async () => {
      try {
        const [serverUrl, apiKey, tabs, excludePinned] = await Promise.all([
          serverUrlItem.getValue(),
          apiKeyItem.getValue(),
          browser.tabs.query({ currentWindow: true }),
          excludePinnedItem.getValue(),
        ]);
        if (!serverUrl || !apiKey) {
          setReady({ kind: 'unconfigured' });
          return;
        }
        setReady({ kind: 'ready', tabs, excludePinned });
      } catch (error) {
        // NOTE: leaving 'loading' would spin forever; an empty tab list disables every save button
        // and lets the banner and the options link explain what happened.
        setReady({ kind: 'ready', tabs: [], excludePinned: false });
        setSave({ kind: 'error', message: describeFailure(error) });
      }
    })();
  }, []);

  const counts = useMemo(() => {
    if (ready.kind !== 'ready') return { all: 0, others: 0, selected: 0 };
    const opts = { excludePinned: ready.excludePinned };
    return {
      all: selectSaveableTabs(ready.tabs, 'all', opts).length,
      others: selectSaveableTabs(ready.tabs, 'others', opts).length,
      selected: selectSaveableTabs(ready.tabs, 'selected', opts).length,
    };
  }, [ready]);

  async function runSave(close: boolean) {
    setSave({ kind: 'saving' });
    try {
      const response = await sendRequest(
        close
          ? { type: 'SAVE_AND_CLOSE', scope }
          : { type: 'SAVE_WITHOUT_CLOSING', scope },
      );
      if (response.type === 'SAVED') {
        setSave({ kind: 'success', result: response.result, closed: close });
        return;
      }
      setSave({ kind: 'error', message: response.message });
    } catch (error) {
      setSave({ kind: 'error', message: describeFailure(error) });
    }
  }

  function openOptions() {
    void browser.runtime.openOptionsPage().catch((error: unknown) => {
      setSave({ kind: 'error', message: describeFailure(error) });
    });
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
        <button onClick={openOptions}>Open Options</button>
        {save.kind === 'error' && <div className="status error">{save.message}</div>}
      </main>
    );
  }

  const currentCount = counts[scope];

  return (
    <main className="popup">
      <header>
        <h1>Karakeep Advanced</h1>
        <button
          type="button"
          className="link"
          onClick={openOptions}
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
          aria-selected={view === 'recent'}
          className={view === 'recent' ? 'tab active' : 'tab'}
          onClick={() => setView('recent')}
        >
          Recent
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
        <button
          type="button"
          role="tab"
          aria-selected={view === 'import'}
          className={view === 'import' ? 'tab active' : 'tab'}
          onClick={() => setView('import')}
        >
          Import
        </button>
      </nav>

      {view === 'save' && (
        <>
          <div className="scope" role="radiogroup" aria-label="Scope">
            {SCOPE_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={scope === s}
                className={scope === s ? 'scope-item active' : 'scope-item'}
                onClick={() => setScope(s)}
              >
                {SCOPE_LABELS[s]} <span className="muted">({counts[s]})</span>
              </button>
            ))}
          </div>

          <p className="count">
            {currentCount} {SCOPE_LABELS[scope].toLowerCase()} tab
            {currentCount === 1 ? '' : 's'} will be saved
            {ready.excludePinned ? ' · pinned excluded' : ''}
          </p>

          <div className="actions">
            <button
              type="button"
              onClick={() => runSave(true)}
              disabled={save.kind === 'saving' || currentCount === 0}
            >
              {save.kind === 'saving' ? 'Saving…' : 'Save & close'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => runSave(false)}
              disabled={save.kind === 'saving' || currentCount === 0}
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

      {view === 'recent' && <RecentGroupsPanel />}
      {view === 'search' && <SearchPanel />}
      {view === 'import' && <ImportPanel />}
    </main>
  );
}
