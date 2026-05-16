import { useEffect, useState } from 'react';
import { sendRequest } from '@/src/messaging/send';
import type { GroupSummary } from '@/src/messaging/schema';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; groups: GroupSummary[] }
  | { kind: 'error'; message: string };

type Action =
  | { kind: 'idle' }
  | { kind: 'opening'; groupId: string }
  | { kind: 'renaming'; groupId: string }
  | { kind: 'deleting'; groupId: string }
  | { kind: 'opened'; opened: number; total: number }
  | { kind: 'error'; message: string };

type RowEdit = { listId: string; draft: string };

const RECENT_LIMIT = 20;

type OpenTarget = 'current' | 'new';

export default function RecentGroupsPanel() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [action, setAction] = useState<Action>({ kind: 'idle' });
  const [edit, setEdit] = useState<RowEdit | null>(null);
  const [openTarget, setOpenTarget] = useState<OpenTarget>('current');

  async function reload() {
    const response = await sendRequest({ type: 'LIST_RECENT_GROUPS', limit: RECENT_LIMIT });
    if (response.type === 'RECENT_GROUPS') {
      setState({ kind: 'ready', groups: response.groups });
    } else {
      setState({ kind: 'error', message: response.message });
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function openAll(group: GroupSummary) {
    const count = group.tabCount;
    const summary = count != null ? `${count} tabs` : 'all tabs';
    const where = openTarget === 'new' ? ' in a new window' : '';
    const ok = window.confirm(`Open ${summary} from "${group.name}"${where}?`);
    if (!ok) return;

    setAction({ kind: 'opening', groupId: group.id });
    const response = await sendRequest({
      type: 'OPEN_GROUP',
      listId: group.id,
      target: openTarget,
    });
    if (response.type === 'OPENED') {
      setAction({ kind: 'opened', opened: response.opened, total: response.total });
    } else {
      setAction({ kind: 'error', message: response.message });
    }
  }

  async function commitRename(group: GroupSummary) {
    if (!edit || edit.listId !== group.id) return;
    const draft = edit.draft.trim();
    if (!draft || draft === group.name) {
      setEdit(null);
      return;
    }

    setAction({ kind: 'renaming', groupId: group.id });
    const response = await sendRequest({
      type: 'RENAME_GROUP',
      listId: group.id,
      name: draft,
    });
    if (response.type === 'RENAMED') {
      setEdit(null);
      setAction({ kind: 'idle' });
      await reload();
    } else {
      setAction({ kind: 'error', message: response.message });
    }
  }

  async function remove(group: GroupSummary) {
    const ok = window.confirm(
      `Delete "${group.name}" from Karakeep? This removes the sub-list (bookmarks stay).`,
    );
    if (!ok) return;

    setAction({ kind: 'deleting', groupId: group.id });
    const response = await sendRequest({ type: 'DELETE_GROUP', listId: group.id });
    if (response.type === 'DELETED') {
      setAction({ kind: 'idle' });
      await reload();
    } else {
      setAction({ kind: 'error', message: response.message });
    }
  }

  if (state.kind === 'loading') {
    return <p className="muted">Loading recent groups…</p>;
  }
  if (state.kind === 'error') {
    return <div className="status error">{state.message}</div>;
  }
  if (state.groups.length === 0) {
    return (
      <p className="muted">
        No tab groups yet. Save your first one from the <strong>Save</strong> tab.
      </p>
    );
  }

  const anyBusy =
    action.kind === 'opening' || action.kind === 'renaming' || action.kind === 'deleting';

  return (
    <div className="recent">
      <div className="recent-toolbar">
        <span className="muted">Open in:</span>
        <div className="recent-target" role="radiogroup" aria-label="Open target">
          <button
            type="button"
            role="radio"
            aria-checked={openTarget === 'current'}
            className={openTarget === 'current' ? 'pill active' : 'pill'}
            onClick={() => setOpenTarget('current')}
            disabled={anyBusy}
          >
            Current window
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={openTarget === 'new'}
            className={openTarget === 'new' ? 'pill active' : 'pill'}
            onClick={() => setOpenTarget('new')}
            disabled={anyBusy}
          >
            New window
          </button>
        </div>
      </div>

      <ul className="recent-list">
        {state.groups.map((group) => {
          const isEditing = edit?.listId === group.id;
          const isOpeningRow = action.kind === 'opening' && action.groupId === group.id;

          return (
            <li key={group.id} className="recent-item">
              {isEditing ? (
                <input
                  type="text"
                  className="recent-edit"
                  value={edit!.draft}
                  autoFocus
                  onChange={(e) => setEdit({ listId: group.id, draft: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void commitRename(group);
                    } else if (e.key === 'Escape') {
                      setEdit(null);
                    }
                  }}
                  onBlur={() => void commitRename(group)}
                />
              ) : (
                <div className="recent-name" title={group.name}>
                  {group.name}
                </div>
              )}

              <div className="recent-row-actions">
                <button
                  type="button"
                  className="icon"
                  title="Rename"
                  onClick={() => setEdit({ listId: group.id, draft: group.name })}
                  disabled={anyBusy}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  className="icon"
                  title="Delete"
                  onClick={() => void remove(group)}
                  disabled={anyBusy}
                >
                  🗑️
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void openAll(group)}
                  disabled={anyBusy}
                >
                  {isOpeningRow
                    ? 'Opening…'
                    : group.tabCount != null
                      ? `Open all (${group.tabCount})`
                      : 'Open all'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {action.kind === 'opened' && (
        <div className="status success">
          Opened {action.opened}/{action.total} tabs.
        </div>
      )}
      {action.kind === 'error' && <div className="status error">{action.message}</div>}
    </div>
  );
}
