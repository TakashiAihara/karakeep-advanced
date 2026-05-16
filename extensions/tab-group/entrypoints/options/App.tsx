import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { checkConnection } from '@/src/karakeep/client';
import { apiKeyItem, serverUrlItem } from '@/src/storage/items';

type Status =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

function isValidUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

async function ensureHostPermission(serverUrl: string): Promise<boolean> {
  const origin = new URL(serverUrl).origin + '/*';
  const granted = await browser.permissions.contains({ origins: [origin] });
  if (granted) return true;
  return browser.permissions.request({ origins: [origin] });
}

export default function App() {
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    void Promise.all([serverUrlItem.getValue(), apiKeyItem.getValue()]).then(([s, k]) => {
      setServerUrl(s);
      setApiKey(k);
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidUrl(serverUrl)) {
      setStatus({ kind: 'error', message: 'Server URL must be http(s)://...' });
      return;
    }
    if (!apiKey.trim()) {
      setStatus({ kind: 'error', message: 'API key is required.' });
      return;
    }

    setStatus({ kind: 'checking' });

    const permissionGranted = await ensureHostPermission(serverUrl);
    if (!permissionGranted) {
      setStatus({
        kind: 'error',
        message:
          'Host permission was not granted. Karakeep Advanced needs access to the server origin to call its API.',
      });
      return;
    }

    const result = await checkConnection({ serverUrl, apiKey });
    if (!result.ok) {
      setStatus({
        kind: 'error',
        message: `Connection failed (${result.status}): ${result.message}`,
      });
      return;
    }

    await Promise.all([
      serverUrlItem.setValue(serverUrl.replace(/\/$/, '')),
      apiKeyItem.setValue(apiKey),
    ]);

    setStatus({
      kind: 'success',
      message: `Connected as ${result.user.name ?? result.user.email}. Settings saved.`,
    });
  }

  return (
    <main>
      <h1>Karakeep Advanced — Tab Group</h1>
      <p className="lead">
        Connect your Karakeep instance. Tab groups will be saved as sub-lists under a parent
        list named &ldquo;Tab Groups&rdquo;.
      </p>

      <form onSubmit={handleSave}>
        <label>
          Server URL
          <small>e.g. http://192.168.0.113 — no trailing slash needed</small>
          <input
            type="url"
            placeholder="http://192.168.0.113"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            autoComplete="url"
            required
          />
        </label>

        <label>
          API key
          <small>
            Issued from Karakeep &rsaquo; Settings &rsaquo; API Keys (format:{' '}
            <code>ak2_…</code>)
          </small>
          <input
            type="password"
            placeholder="ak2_xxxxxxxxxxxx_xxxxxxxxxxxx"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            autoComplete="off"
            required
          />
        </label>

        <div className="row">
          <button type="submit" disabled={status.kind === 'checking'}>
            {status.kind === 'checking' ? 'Checking…' : 'Test connection & save'}
          </button>
        </div>

        {status.kind === 'success' && <div className="status success">{status.message}</div>}
        {status.kind === 'error' && <div className="status error">{status.message}</div>}
      </form>
    </main>
  );
}
