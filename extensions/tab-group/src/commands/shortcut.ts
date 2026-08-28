import { browser } from 'wxt/browser';
import { handle } from '@/src/messaging/handler';
import type { Response } from '@/src/messaging/schema';
import { notify, NOTIFY_TITLE } from '@/src/util/notify';

export const SAVE_AND_CLOSE_COMMAND = 'save-tab-group';
export const SAVE_WITHOUT_CLOSING_COMMAND = 'save-without-closing';

const KNOWN_COMMANDS: ReadonlySet<string> = new Set([
  SAVE_AND_CLOSE_COMMAND,
  SAVE_WITHOUT_CLOSING_COMMAND,
]);

export async function runShortcutCommand(command: string): Promise<void> {
  if (!KNOWN_COMMANDS.has(command)) return;

  const close = command === SAVE_AND_CLOSE_COMMAND;

  // handle() announces every save outcome itself, so nothing is reported here; doing it
  // in both places stacked two identical toasts on every shortcut press.
  let response: Response;
  try {
    response = await handle(
      close
        ? { type: 'SAVE_AND_CLOSE', scope: 'all' }
        : { type: 'SAVE_WITHOUT_CLOSING', scope: 'all' },
    );
  } catch (err) {
    // a rejection escaping handle() bypasses its notification, and there is no popup here
    await notify(NOTIFY_TITLE, err instanceof Error ? err.message : String(err));
    return;
  }

  if (response.type !== 'SAVED' && response.type !== 'ERROR') {
    await notify(NOTIFY_TITLE, `Unexpected response to a save (${response.type}).`);
  }
}

export function registerShortcutCommands(): void {
  browser.commands.onCommand.addListener((command) => {
    void runShortcutCommand(command);
  });
}
