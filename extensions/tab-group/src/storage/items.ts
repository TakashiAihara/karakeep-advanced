import { storage } from 'wxt/utils/storage';

export const serverUrlItem = storage.defineItem<string>('local:serverUrl', {
  fallback: '',
});

export const apiKeyItem = storage.defineItem<string>('local:apiKey', {
  fallback: '',
});

export const tabGroupsListIdItem = storage.defineItem<string | null>(
  'local:tabGroupsListId',
  { fallback: null },
);

export const recentGroupIdsItem = storage.defineItem<string[]>(
  'local:recentGroupIds',
  { fallback: [] },
);

export async function loadKarakeepConfig(): Promise<{ serverUrl: string; apiKey: string }> {
  const [serverUrl, apiKey] = await Promise.all([
    serverUrlItem.getValue(),
    apiKeyItem.getValue(),
  ]);
  return { serverUrl, apiKey };
}
