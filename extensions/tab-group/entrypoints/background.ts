import { registerShortcutCommands } from '@/src/commands/shortcut';
import { registerMessageHandler } from '@/src/messaging/handler';

export default defineBackground(() => {
  registerMessageHandler();
  registerShortcutCommands();
});
