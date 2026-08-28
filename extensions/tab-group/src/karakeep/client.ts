import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

export type KarakeepConfig = {
  serverUrl: string;
  apiKey: string;
};

export type RetryPolicy = {
  maxAttempts: number;
  timeoutMs: number;
};

export const RETRY_MAX_ATTEMPTS = 3;
export const RETRY_BASE_DELAY_MS = 300;
export const RETRY_MAX_DELAY_MS = 2_000;
export const RETRY_MAX_TOTAL_DELAY_MS = 3_000;
export const REQUEST_TIMEOUT_MS = 10_000;
export const CONNECTION_CHECK_MAX_ATTEMPTS = 2;
export const CONNECTION_CHECK_TIMEOUT_MS = 5_000;
export const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: RETRY_MAX_ATTEMPTS,
  timeoutMs: REQUEST_TIMEOUT_MS,
};

let cached: { config: KarakeepConfig; client: Client<paths> } | null = null;

function buildBaseUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/$/, '')}/api/v1`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function backoffDelay(attempt: number): number {
  const ceiling = Math.min(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1), RETRY_MAX_DELAY_MS);
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

function retryAfterDelay(response: Response): number | null {
  const header = response.headers.get('Retry-After')?.trim();
  if (!header) return null;

  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(header) - Date.now();
  if (!Number.isFinite(ms)) return null;

  return Math.min(Math.max(ms, 0), RETRY_MAX_DELAY_MS);
}

/**
 * Whether repeating this request can create a second thing.
 *
 * A 502 or 504 from a proxy in front of a restarting Karakeep usually means the write
 * landed and only the answer was lost, so retrying a non-idempotent write duplicates it.
 * That is exactly the sub-list duplication the save flow was reworked to prevent, and
 * retrying blindly would have reintroduced it one layer down.
 *
 * GET, PUT and DELETE are idempotent by HTTP semantics, and PATCH here assigns fields
 * rather than accumulating, so repeating it lands on the same state. Of the POSTs, only
 * /bookmarks is safe: it answers 200 with the existing bookmark for a duplicate URL
 * (documented on createBookmark). POST /lists has no such guarantee and must not repeat.
 */
export function isRetryableRequest(method: string, url: string): boolean {
  const verb = method.toUpperCase();
  if (verb === 'GET' || verb === 'HEAD' || verb === 'PUT' || verb === 'DELETE') return true;
  if (verb === 'PATCH') return true;
  if (verb !== 'POST') return false;

  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  return /\/bookmarks\/?$/.test(path);
}

/**
 * Statuses the fetch spec defines as null-body.
 *
 * Rebuilding one of these with a body is a spec violation that browsers reject, so the body
 * is dropped explicitly rather than handed to the Response constructor. Not verified here:
 * Bun, which runs the unit tests, accepts it either way, so this guard is load-bearing only
 * in the browser the extension actually ships to.
 */
const BODILESS_STATUSES: ReadonlySet<number> = new Set([204, 205, 304]);

async function bufferResponse(raw: Response): Promise<Response> {
  if (BODILESS_STATUSES.has(raw.status)) {
    await raw.arrayBuffer().catch(() => undefined);
    return new Response(null, {
      status: raw.status,
      statusText: raw.statusText,
      headers: raw.headers,
    });
  }

  const body = await raw.arrayBuffer();
  return new Response(body, {
    status: raw.status,
    statusText: raw.statusText,
    headers: raw.headers,
  });
}

function createRetryingFetch(policy: RetryPolicy): (input: Request) => Promise<Response> {
  return async (input) => {
    let delayBudgetMs = RETRY_MAX_TOTAL_DELAY_MS;
    const retryable = isRetryableRequest(input.method, input.url);

    for (let attempt = 1; ; attempt++) {
      const timeout = new AbortController();
      const timer = setTimeout(() => {
        timeout.abort(new Error(`Karakeep did not answer within ${policy.timeoutMs}ms.`));
      }, policy.timeoutMs);

      let response: Response | null = null;
      let failure: unknown = null;
      try {
        const raw = await globalThis.fetch(input.clone(), {
          signal: AbortSignal.any([input.signal, timeout.signal]),
        });
        // The body is read here, while the timer is still armed. Clearing the timeout as
        // soon as headers arrive left the body read unbounded, so a server that answered
        // and then stalled mid-body hung for as long as it liked. Buffering also disposes
        // of the bodies of responses that are about to be retried and thrown away.
        response = await bufferResponse(raw);
      } catch (e) {
        failure = e;
      } finally {
        clearTimeout(timer);
      }

      if (response && !RETRYABLE_STATUSES.has(response.status)) return response;
      if (input.signal.aborted) throw failure ?? input.signal.reason;
      if (!retryable) {
        if (response) return response;
        throw failure ?? new Error('Karakeep request failed.');
      }
      if (attempt >= policy.maxAttempts) {
        if (response) return response;
        throw failure ?? new Error('Karakeep request failed.');
      }

      const wait = Math.min(
        (response && retryAfterDelay(response)) ?? backoffDelay(attempt),
        delayBudgetMs,
      );
      delayBudgetMs -= wait;
      await sleep(wait);
    }
  };
}

function buildClient(
  config: KarakeepConfig,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Client<paths> {
  const auth: Middleware = {
    async onRequest({ request }) {
      request.headers.set('Authorization', `Bearer ${config.apiKey}`);
      return request;
    },
  };

  const client = createClient<paths>({
    baseUrl: buildBaseUrl(config.serverUrl),
    fetch: createRetryingFetch(policy),
  });
  client.use(auth);
  return client;
}

export function configureKarakeep(config: KarakeepConfig): Client<paths> {
  cached = { config, client: buildClient(config) };
  return cached.client;
}

export function getKarakeep(): Client<paths> {
  if (!cached) {
    throw new Error(
      'Karakeep client is not configured. Call configureKarakeep() with serverUrl and apiKey first.',
    );
  }
  return cached.client;
}

export function resetKarakeep(): void {
  cached = null;
}

type GetCurrentUserResponse = NonNullable<
  paths['/users/me']['get']['responses']['200']['content']['application/json']
>;

export type ConnectionCheckResult = {
  ok: true;
  user: GetCurrentUserResponse;
};

export type ConnectionCheckError = {
  ok: false;
  status: number;
  message: string;
};

export async function checkConnection(
  config: KarakeepConfig,
): Promise<ConnectionCheckResult | ConnectionCheckError> {
  // Halved against a background save because the user is watching this one: two attempts
  // and 5s bound the button at ~12s, where the save's 3 x 10s would look like a hang.
  const client = buildClient(config, {
    maxAttempts: CONNECTION_CHECK_MAX_ATTEMPTS,
    timeoutMs: CONNECTION_CHECK_TIMEOUT_MS,
  });

  try {
    const { data, error, response } = await client.GET('/users/me');

    if (error || !data) {
      return {
        ok: false,
        status: response.status,
        message:
          (error as { error?: string } | undefined)?.error ??
          `HTTP ${response.status} ${response.statusText}`,
      };
    }

    return { ok: true, user: data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      message: e instanceof Error ? e.message : 'Network request failed',
    };
  }
}
