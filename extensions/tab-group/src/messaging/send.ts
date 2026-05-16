import { browser } from 'wxt/browser';
import type { Request, Response } from './schema';

export async function sendRequest(request: Request): Promise<Response> {
  return (await browser.runtime.sendMessage(request)) as Response;
}
