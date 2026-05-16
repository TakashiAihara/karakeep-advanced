import { Command } from 'cmdk';
import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { sendRequest } from '@/src/messaging/send';
import type { SearchHit } from '@/src/messaging/schema';

const DEBOUNCE_MS = 250;

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; hits: SearchHit[] }
  | { kind: 'empty' }
  | { kind: 'error'; message: string };

async function openHit(hit: SearchHit, options: { active: boolean }): Promise<void> {
  await browser.tabs.create({ url: hit.url, active: options.active });
}

export default function SearchPanel() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const seqRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setState({ kind: 'idle' });
      return;
    }
    const seq = ++seqRef.current;
    setState({ kind: 'loading' });
    const timer = window.setTimeout(async () => {
      const response = await sendRequest({ type: 'SEARCH', q: trimmed });
      if (seq !== seqRef.current) return;
      if (response.type === 'SEARCH_RESULT') {
        setState(
          response.hits.length > 0
            ? { kind: 'ready', hits: response.hits }
            : { kind: 'empty' },
        );
      } else if (response.type === 'ERROR') {
        setState({ kind: 'error', message: response.message });
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  function handleSelect(hit: SearchHit, event: KeyboardEvent | MouseEvent | undefined) {
    const modifier =
      event &&
      ('metaKey' in event && event.metaKey) ||
      (event && 'ctrlKey' in event && event.ctrlKey);
    void openHit(hit, { active: !modifier });
    if (!modifier) window.close();
  }

  return (
    <div className="search">
      <Command
        shouldFilter={false}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          if (state.kind !== 'ready') return;
          const items = document.querySelectorAll<HTMLDivElement>(
            '[cmdk-item][data-selected="true"]',
          );
          const selected = items[0];
          if (!selected) return;
          const id = selected.dataset.hitId;
          const hit = state.hits.find((h) => h.id === id);
          if (hit) {
            event.preventDefault();
            handleSelect(hit, event.nativeEvent);
          }
        }}
      >
        <Command.Input
          placeholder="Search Karakeep bookmarks…"
          value={query}
          onValueChange={setQuery}
          autoFocus
        />
        <Command.List>
          {state.kind === 'loading' && <Command.Loading>Searching…</Command.Loading>}
          {state.kind === 'idle' && (
            <Command.Empty className="muted">Type to search.</Command.Empty>
          )}
          {state.kind === 'empty' && (
            <Command.Empty className="muted">No matching bookmarks.</Command.Empty>
          )}
          {state.kind === 'error' && (
            <div className="status error" role="alert">
              {state.message}
            </div>
          )}
          {state.kind === 'ready' &&
            state.hits.map((hit) => (
              <Command.Item
                key={hit.id}
                value={`${hit.title} ${hit.url}`}
                data-hit-id={hit.id}
                onSelect={() => handleSelect(hit, undefined)}
              >
                {hit.faviconUrl && (
                  <img
                    src={hit.faviconUrl}
                    alt=""
                    className="favicon"
                    width={14}
                    height={14}
                    loading="lazy"
                  />
                )}
                <span className="hit-title">{hit.title}</span>
                <span className="hit-url muted">{hit.url}</span>
              </Command.Item>
            ))}
        </Command.List>
      </Command>
      <p className="muted hint">
        Enter / click: open and close popup &middot; Cmd/Ctrl+Enter: open in background tab
      </p>
    </div>
  );
}
