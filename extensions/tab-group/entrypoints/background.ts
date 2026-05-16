import { registerMessageHandler } from '@/src/messaging/handler';

export default defineBackground(() => {
  registerMessageHandler();
});
