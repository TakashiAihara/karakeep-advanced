import { useEffect, useState } from 'react';
import { sendRequest } from '@/src/messaging/send';
import type { GroupSummary } from '@/src/messaging/schema';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; groups: GroupSummary[] }
  | { kind: 'error'; message: string };

type OpenStatus =
  | { kind: 'idle' }
  | { kind: 'opening'; groupId: string }
  | { kind: 'opened'; opened: number; total: number }
  | { kind: 'error'; message: string };

const RECENT_LIMIT = 20;

export default function RecentGroupsPanel() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [openStatus, setOpenStatus] = useState<OpenStatus>({ kind: 'idle' });

  useEffect(() => {
    void (async () => {
      const response = await sendRequest({ type: 'LIST_RECENT_GROUPS', limit: RECENT_LIMIT });
      if (response.type === 'RECENT_GROUPS') {
        setState({ kind: 'ready', groups: response.groups });
      } else {
        setState({ kind: 'error', message: response.message });
      }
    })();
  }, []);

  async function openAll(group: GroupSummary) {
    const count = group.tabCount;
    const summary = count != null ? `${count} tabs` : 'all tabs';
    const ok = window.confirm(`Open ${summary} from "${group.name}"?`);
    if (!ok) return;

    setOpenStatus({ kind: 'opening', groupId: group.id });
    const response = await sendRequest({ type: 'OPEN_GROUP', listId: group.id });
    if (response.type === 'OPENED') {
      setOpenStatus({ kind: 'opened', opened: response.opened, total: response.total });
    } else {
      setOpenStatus({ kind: 'error', message: response.message });
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

  return (
    <div className="recent">
      <ul className="recent-list">
        {state.groups.map((group) => {
          const busy = openStatus.kind === 'opening' && openStatus.groupId === group.id;
          return (
            <li key={group.id} className="recent-item">
              <div className="recent-name" title={group.name}>
                {group.name}
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => openAll(group)}
                disabled={openStatus.kind === 'opening'}
              >
                {busy
                  ? 'Opening…'
                  : group.tabCount != null
                    ? `Open all (${group.tabCount})`
                    : 'Open all'}
              </button>
            </li>
          );
        })}
      </ul>

      {openStatus.kind === 'opened' && (
        <div className="status success">
          Opened {openStatus.opened}/{openStatus.total} tabs.
        </div>
      )}
      {openStatus.kind === 'error' && (
        <div className="status error">{openStatus.message}</div>
      )}
    </div>
  );
}
