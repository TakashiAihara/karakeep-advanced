import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from './schema';

export type KarakeepConfig = {
  serverUrl: string;
  apiKey: string;
};

let cached: { config: KarakeepConfig; client: Client<paths> } | null = null;

function buildBaseUrl(serverUrl: string): string {
  return `${serverUrl.replace(/\/$/, '')}/api/v1`;
}

function buildClient(config: KarakeepConfig): Client<paths> {
  const auth: Middleware = {
    async onRequest({ request }) {
      request.headers.set('Authorization', `Bearer ${config.apiKey}`);
      return request;
    },
  };

  const client = createClient<paths>({ baseUrl: buildBaseUrl(config.serverUrl) });
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
  const client = buildClient(config);

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
