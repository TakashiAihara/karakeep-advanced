import { useEffect, useState } from 'react';
import { sendRequest } from '@/src/messaging/send';
import type { Request } from '@/src/messaging/schema';
import type { SaveJob, SaveReport } from '@/src/storage/items';
import { describeFailure } from '../describe-failure';

/**
 * The only way out of the two states a save can leave behind.
 *
 * An unfinished job blocks every new save until it is resumed or discarded, and a
 * half-failed save leaves its tabs open "so you can retry". Both are handled in the
 * background worker; without this panel neither has a button anywhere.
 */
export default function SaveRecovery() {
  const [job, setJob] = useState<SaveJob | null>(null);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<SaveReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const [pending, last] = await Promise.all([
      sendRequest({ type: 'GET_PENDING_JOB' }),
      sendRequest({ type: 'GET_LAST_REPORT' }),
    ]);
    setJob(pending.type === 'PENDING_JOB' ? pending.job : null);
    setRunning(pending.type === 'PENDING_JOB' && pending.running);
    setReport(last.type === 'LAST_REPORT' ? last.report : null);
  }

  useEffect(() => {
    load().catch((error: unknown) => setMessage(describeFailure(error)));
  }, []);

  async function run(request: Request) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await sendRequest(request);
      if (response.type === 'ERROR') {
        setMessage(response.message);
      } else if (response.type === 'SAVED') {
        const { savedCount, totalCount, subListName } = response.result;
        setMessage(`Saved ${savedCount}/${totalCount} to ${subListName}`);
      }
      await load();
    } catch (error) {
      setMessage(describeFailure(error));
    } finally {
      setBusy(false);
    }
  }

  function discard() {
    if (!job) return;
    const ok = window.confirm(
      `Discard the unfinished save of "${job.subListName}"? The group and the bookmarks already written stay in Karakeep; the tabs that were not saved yet are dropped.`,
    );
    if (ok) void run({ type: 'DISCARD_JOB' });
  }

  if (job && running) {
    return (
      <div className="status recovery" role="status">
        <p>
          Saving <strong>{job.subListName}</strong>… Reopen the popup to see the result.
        </p>
      </div>
    );
  }

  if (job) {
    const done = job.tabs.filter((tab) => tab.state === 'attached').length;
    return (
      <div className="status recovery" role="alert">
        <p>
          Unfinished save <strong>{job.subListName}</strong> — {done}/{job.tabs.length} saved.
          New saves are blocked until it is resumed or discarded.
        </p>
        <div className="actions">
          <button type="button" onClick={() => void run({ type: 'RESUME_JOB' })} disabled={busy}>
            {busy ? 'Working…' : 'Resume'}
          </button>
          <button type="button" className="secondary" onClick={discard} disabled={busy}>
            Discard
          </button>
        </div>
        {message && <p className="muted">{message}</p>}
      </div>
    );
  }

  if (report && report.failed.length > 0) {
    return (
      <div className="status recovery" role="alert">
        <p>
          Last save <strong>{report.subListName}</strong>: {report.failed.length} of{' '}
          {report.totalCount} failed.
        </p>
        <details>
          <summary>Failed URLs</summary>
          <ul>
            {report.failed.map((failure, i) => (
              <li key={`${i}:${failure.url}`}>
                {failure.url} <span className="muted">— {failure.reason}</span>
              </li>
            ))}
          </ul>
        </details>
        {report.closeAfter && (
          <p className="muted">
            Retrying closes the {report.totalCount} tabs of this save that are still open.
          </p>
        )}
        <div className="actions">
          <button
            type="button"
            onClick={() => void run({ type: 'RETRY_FAILED' })}
            disabled={busy}
          >
            {busy ? 'Retrying…' : `Retry failed (${report.failed.length})`}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void run({ type: 'DISMISS_LAST_REPORT' })}
            disabled={busy}
          >
            Dismiss
          </button>
        </div>
        {message && <p className="muted">{message}</p>}
      </div>
    );
  }

  return message ? <div className="status">{message}</div> : null;
}
