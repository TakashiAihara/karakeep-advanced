import { browser } from 'wxt/browser';
import { handle } from '@/src/messaging/handler';
import type { Response } from '@/src/messaging/schema';

export const SAVE_AND_CLOSE_COMMAND = 'save-tab-group';
export const SAVE_WITHOUT_CLOSING_COMMAND = 'save-without-closing';

const KNOWN_COMMANDS: ReadonlySet<string> = new Set([
  SAVE_AND_CLOSE_COMMAND,
  SAVE_WITHOUT_CLOSING_COMMAND,
]);

function iconUrl(): string {
  return browser.runtime.getURL('/icon/128.png');
}

async function notify(title: string, message: string): Promise<void> {
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

function describeSuccess(response: Extract<Response, { type: 'SAVED' }>): string {
  const { result } = response;
  const base = `Saved ${result.savedCount}/${result.totalCount} → ${result.subListName}`;
  const failed = result.failed.length > 0 ? `, ${result.failed.length} failed` : '';
  const closed = result.closedTabs > 0 ? `, closed ${result.closedTabs}` : '';
  return `${base}${failed}${closed}`;
}

export async function runShortcutCommand(command: string): Promise<void> {
  if (!KNOWN_COMMANDS.has(command)) return;

  const close = command === SAVE_AND_CLOSE_COMMAND;
  const response = await handle(
    close
      ? { type: 'SAVE_AND_CLOSE', scope: 'all' }
      : { type: 'SAVE_WITHOUT_CLOSING', scope: 'all' },
  );

  if (response.type === 'SAVED') {
    await notify('Karakeep Advanced', describeSuccess(response));
    return;
  }
  if (response.type === 'ERROR') {
    await notify('Karakeep Advanced', response.message);
  }
}

export function registerShortcutCommands(): void {
  browser.commands.onCommand.addListener((command) => {
    void runShortcutCommand(command);
  });
}
