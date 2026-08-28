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

/**
 * One-line summary of a finished save, for the notification.
 *
 * Reads closeAfter rather than inferring intent from closedTabs. Inferring it was wrong on
 * three of the four paths that reach here: "save without closing", the context-menu
 * single-page save and the retry all leave tabs open by design, and telling the user they
 * were "left open so you can retry" invented a failure that had not happened.
 *
 * A close that asked for N tabs and got fewer is reported explicitly. Tabs are only closed
 * when nothing failed, and a captured tab whose URL has drifted since is skipped, so the
 * shortfall is real information rather than an internal detail.
 */
export function describeSaveResult(result: SaveResult): string {
  const parts = [
    `Saved ${result.savedCount}/${result.totalCount} \u2192 ${result.subListName}`,
  ];

  if (result.failed.length > 0) {
    parts.push(`${result.failed.length} failed`);
  }

  if (!result.closeAfter) {
    return parts.join(', ');
  }

  if (result.failed.length > 0) {
    parts.push('tabs left open so you can retry');
  } else if (result.closedTabs === result.totalCount) {
    parts.push(`closed ${result.closedTabs}`);
  } else {
    parts.push(
      `closed ${result.closedTabs} of ${result.totalCount}, the rest had moved on`,
    );
  }

  return parts.join(', ');
}
