import { browser } from 'wxt/browser';
import type { SaveResult } from '@/src/messaging/schema';

export const NOTIFY_TITLE = 'Karakeep Advanced';

function iconUrl(): string {
  return browser.runtime.getURL('/icon/128.png');
}

export async function notify(title: string, message: string): Promise<void> {
  try {
    await browser.notifications.create({
      type: 'basic',
      iconUrl: iconUrl(),
      title,
      message,
    });
  } catch {
    // notifications permission missing or platform unsupported — log only
    console.warn('[karakeep-advanced] notification suppressed:', title, message);
  }
}

// a save closes tabs only when nothing failed, so a partial save must say why the window
// is untouched — otherwise the shortcut looks like it did nothing
export function describeSaveResult(result: SaveResult): string {
  const parts = [`Saved ${result.savedCount}/${result.totalCount} → ${result.subListName}`];
  if (result.failed.length > 0) {
    parts.push(`${result.failed.length} failed`);
  }
  if (result.closedTabs > 0) {
    parts.push(`closed ${result.closedTabs}`);
  } else if (result.failed.length > 0) {
    parts.push('tabs left open so you can retry');
  }
  return parts.join(', ');
}
