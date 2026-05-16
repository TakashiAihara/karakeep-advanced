import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

type ListType = 'manual' | 'smart';

type MockList = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  parentId: string | null;
  type: ListType;
  query: string | null;
  public: boolean;
  hasCollaborators: boolean;
  userRole: 'owner' | 'editor' | 'viewer' | 'public';
};

type MockBookmark = {
  id: string;
  createdAt: string;
  modifiedAt: string | null;
  title: string | null;
  archived: boolean;
  favourited: boolean;
  taggingStatus: 'success' | 'failure' | 'pending' | null;
  summarizationStatus: 'success' | 'failure' | 'pending' | null;
  note: string | null;
  summary: string | null;
  source: 'api' | 'web' | 'cli' | 'mobile' | 'extension' | 'singlefile' | 'rss' | 'import' | null;
  userId: string;
  tags: never[];
  content: {
    type: 'link';
    url: string;
    title: string | null;
    description: null;
    imageUrl: null;
    imageAssetId: null;
    screenshotAssetId: null;
    pdfAssetId: null;
    fullPageArchiveAssetId: null;
    precrawledArchiveAssetId: null;
    videoAssetId: null;
    favicon: null;
    htmlContent: null;
    contentAssetId: null;
    crawledAt: null;
    crawlStatus: 'success' | 'failure' | 'pending' | null;
    author: null;
    publisher: null;
    datePublished: null;
    dateModified: null;
  };
};

export type MockStore = {
  lists: Map<string, MockList>;
  bookmarks: Map<string, MockBookmark>;
  listBookmarks: Map<string, Set<string>>;
};

export type MockServer = {
  url: string;
  store: MockStore;
  stop: () => Promise<void>;
};

const USER = {
  id: 'u1',
  email: 'test@example.com',
  name: 'Test User',
  image: null,
  localUser: true,
};

function writeJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
}

function writeNoContent(res: ServerResponse): void {
  res.writeHead(204);
  res.end();
}

function writeUnauthorized(res: ServerResponse): void {
  res.writeHead(401, { 'content-type': 'text/plain' });
  res.end('Unauthorized');
}

function writeNotFound(res: ServerResponse, message = 'Not Found'): void {
  writeJson(res, 404, { error: message });
}

function writeBadRequest(res: ServerResponse, message: string): void {
  writeJson(res, 400, { error: message });
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  let buffer = '';
  for await (const chunk of req) buffer += chunk;
  if (!buffer) return {};
  return JSON.parse(buffer);
}

function matchPath(pathname: string, pattern: string): RegExpMatchArray | null {
  const regex = new RegExp(
    '^' +
      pattern.replace(/{[^}]+}/g, '([^/]+)').replace(/\//g, '\\/') +
      '$',
  );
  return pathname.match(regex);
}

function makeId(prefix: string, counter: number): string {
  return `${prefix}-${counter.toString().padStart(6, '0')}`;
}

export function startMockServer(): Promise<MockServer> {
  const store: MockStore = {
    lists: new Map(),
    bookmarks: new Map(),
    listBookmarks: new Map(),
  };
  let counter = 0;

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://internal');
      const pathname = url.pathname;
      const method = req.method ?? 'GET';

      const auth = req.headers['authorization'];
      if (!auth || !auth.startsWith('Bearer ')) {
        writeUnauthorized(res);
        return;
      }

      if (pathname === '/api/v1/users/me' && method === 'GET') {
        writeJson(res, 200, USER);
        return;
      }

      if (pathname === '/api/v1/lists' && method === 'GET') {
        writeJson(res, 200, { lists: [...store.lists.values()] });
        return;
      }

      if (pathname === '/api/v1/lists' && method === 'POST') {
        const body = (await readJson(req)) as Partial<MockList>;
        if (!body.name || !body.icon) {
          writeBadRequest(res, 'name and icon are required');
          return;
        }
        const id = makeId('list', ++counter);
        const list: MockList = {
          id,
          name: body.name,
          description: null,
          icon: body.icon,
          parentId: body.parentId ?? null,
          type: (body.type as ListType) ?? 'manual',
          query: null,
          public: false,
          hasCollaborators: false,
          userRole: 'owner',
        };
        store.lists.set(id, list);
        store.listBookmarks.set(id, new Set());
        writeJson(res, 201, list);
        return;
      }

      const listIdMatch = matchPath(pathname, '/api/v1/lists/{listId}');
      if (listIdMatch) {
        const id = decodeURIComponent(listIdMatch[1]!);
        const list = store.lists.get(id);
        if (!list) {
          writeNotFound(res, 'list not found');
          return;
        }
        if (method === 'GET') {
          writeJson(res, 200, list);
          return;
        }
        if (method === 'PATCH') {
          const body = (await readJson(req)) as Partial<MockList>;
          if (typeof body.name === 'string') list.name = body.name;
          if (typeof body.icon === 'string') list.icon = body.icon;
          writeJson(res, 200, list);
          return;
        }
        if (method === 'DELETE') {
          store.lists.delete(id);
          store.listBookmarks.delete(id);
          writeNoContent(res);
          return;
        }
      }

      const listBookmarksMatch = matchPath(pathname, '/api/v1/lists/{listId}/bookmarks');
      if (listBookmarksMatch && method === 'GET') {
        const id = decodeURIComponent(listBookmarksMatch[1]!);
        const ids = store.listBookmarks.get(id);
        if (!ids) {
          writeNotFound(res, 'list not found');
          return;
        }
        const bookmarks = [...ids]
          .map((bid) => store.bookmarks.get(bid))
          .filter((b): b is MockBookmark => b != null);
        writeJson(res, 200, { bookmarks, nextCursor: null });
        return;
      }

      const listBookmarkMatch = matchPath(
        pathname,
        '/api/v1/lists/{listId}/bookmarks/{bookmarkId}',
      );
      if (listBookmarkMatch) {
        const listId = decodeURIComponent(listBookmarkMatch[1]!);
        const bookmarkId = decodeURIComponent(listBookmarkMatch[2]!);
        const attached = store.listBookmarks.get(listId);
        if (!attached) {
          writeNotFound(res, 'list not found');
          return;
        }
        if (!store.bookmarks.has(bookmarkId)) {
          writeNotFound(res, 'bookmark not found');
          return;
        }
        if (method === 'PUT') {
          attached.add(bookmarkId);
          writeNoContent(res);
          return;
        }
        if (method === 'DELETE') {
          attached.delete(bookmarkId);
          writeNoContent(res);
          return;
        }
      }

      if (pathname === '/api/v1/bookmarks' && method === 'POST') {
        const body = (await readJson(req)) as {
          type: 'link';
          url: string;
          title?: string;
          source?: MockBookmark['source'];
        };
        const existing = [...store.bookmarks.values()].find(
          (b) => b.content.type === 'link' && b.content.url === body.url,
        );
        if (existing) {
          writeJson(res, 200, existing);
          return;
        }
        const id = makeId('bm', ++counter);
        const bookmark: MockBookmark = {
          id,
          createdAt: new Date().toISOString(),
          modifiedAt: null,
          title: body.title ?? null,
          archived: false,
          favourited: false,
          taggingStatus: null,
          summarizationStatus: null,
          note: null,
          summary: null,
          source: body.source ?? null,
          userId: USER.id,
          tags: [],
          content: {
            type: 'link',
            url: body.url,
            title: body.title ?? null,
            description: null,
            imageUrl: null,
            imageAssetId: null,
            screenshotAssetId: null,
            pdfAssetId: null,
            fullPageArchiveAssetId: null,
            precrawledArchiveAssetId: null,
            videoAssetId: null,
            favicon: null,
            htmlContent: null,
            contentAssetId: null,
            crawledAt: null,
            crawlStatus: null,
            author: null,
            publisher: null,
            datePublished: null,
            dateModified: null,
          },
        };
        store.bookmarks.set(id, bookmark);
        writeJson(res, 201, bookmark);
        return;
      }

      if (pathname === '/api/v1/bookmarks/search' && method === 'GET') {
        const q = (url.searchParams.get('q') ?? '').toLowerCase();
        const matches = [...store.bookmarks.values()].filter((b) => {
          const haystack = `${b.title ?? ''} ${b.content.type === 'link' ? b.content.url : ''}`.toLowerCase();
          return haystack.includes(q);
        });
        writeJson(res, 200, { bookmarks: matches, nextCursor: null });
        return;
      }

      writeNotFound(res);
    } catch (err) {
      writeJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  return new Promise<MockServer>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        store,
        stop: () =>
          new Promise<void>((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
  });
}
