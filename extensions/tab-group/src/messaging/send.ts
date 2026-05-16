import { browser } from 'wxt/browser';
import type { Request, Response } from './schema';

type ResponseFor<R extends Request> = R['type'] extends 'SAVE_AND_CLOSE' | 'SAVE_WITHOUT_CLOSING'
  ? Extract<Response, { type: 'SAVED' | 'ERROR' }>
  : R['type'] extends 'SEARCH'
    ? Extract<Response, { type: 'SEARCH_RESULT' | 'ERROR' }>
    : R['type'] extends 'LIST_RECENT_GROUPS'
      ? Extract<Response, { type: 'RECENT_GROUPS' | 'ERROR' }>
      : R['type'] extends 'OPEN_GROUP'
        ? Extract<Response, { type: 'OPENED' | 'ERROR' }>
        : R['type'] extends 'IMPORT_ONETAB'
          ? Extract<Response, { type: 'IMPORTED' | 'ERROR' }>
          : Response;

export async function sendRequest<R extends Request>(request: R): Promise<ResponseFor<R>> {
  return (await browser.runtime.sendMessage(request)) as ResponseFor<R>;
}
