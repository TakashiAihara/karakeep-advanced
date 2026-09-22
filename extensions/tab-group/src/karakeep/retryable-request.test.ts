import { describe, expect, it } from 'vitest';
import { isRetryableRequest } from './client';

const BASE = 'https://karakeep.example/api/v1';

describe('isRetryableRequest', () => {
  it.each([
    ['GET', `${BASE}/lists`],
    ['GET', `${BASE}/bookmarks/search?q=x`],
    ['PUT', `${BASE}/lists/abc/bookmarks/def`],
    ['DELETE', `${BASE}/lists/abc`],
    ['DELETE', `${BASE}/lists/abc/bookmarks/def`],
    ['PATCH', `${BASE}/lists/abc`],
  ])('retries %s %s', (method, url) => {
    expect(isRetryableRequest(method, url)).toBe(true);
  });

  // The one POST the server documents as safe to repeat: a duplicate URL answers 200 with
  // the bookmark that already exists.
  it('retries POST /bookmarks', () => {
    expect(isRetryableRequest('POST', `${BASE}/bookmarks`)).toBe(true);
  });

  // The defect this pins: a 502 from a proxy in front of a restarting Karakeep usually
  // means the list was created and only the answer was lost, so repeating it made three.
  it('does not retry POST /lists', () => {
    expect(isRetryableRequest('POST', `${BASE}/lists`)).toBe(false);
  });

  it('does not retry an unknown POST', () => {
    expect(isRetryableRequest('POST', `${BASE}/assets`)).toBe(false);
  });

  // /lists/{id}/bookmarks is a GET collection, but the suffix match must not be fooled into
  // treating some future POST to it as the safe /bookmarks create.
  it('is decided by method as well as path', () => {
    expect(isRetryableRequest('GET', `${BASE}/lists/abc/bookmarks`)).toBe(true);
  });

  it('accepts a lowercase method', () => {
    expect(isRetryableRequest('post', `${BASE}/lists`)).toBe(false);
    expect(isRetryableRequest('get', `${BASE}/lists`)).toBe(true);
  });

  // Anything that is neither a known-idempotent verb nor the one safe POST has to default
  // to not retrying; a verb this code has never seen is not one to guess about.
  it.each(['OPTIONS', 'TRACE', 'PROPFIND', ''])(
    'does not retry the unrecognised method %j',
    (method) => {
      expect(isRetryableRequest(method, `${BASE}/lists`)).toBe(false);
    },
  );

  it('does not throw on a malformed url', () => {
    expect(() => isRetryableRequest('POST', 'not a url')).not.toThrow();
  });
});
