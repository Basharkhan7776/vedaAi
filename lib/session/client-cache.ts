// Client-side robust caching for evaluation payloads and large page images
// Uses in-memory global cache + IndexedDB + safe lightweight sessionStorage

const DB_NAME = "veda_ai_db";
const STORE_NAME = "session_cache";
const DB_VERSION = 1;

export interface CachedSession {
  ok: boolean;
  evaluation?: any;
  failure?: any;
  pageImages?: string[];
  hasPageImages?: boolean;
}

const memoryCache = new Map<string, CachedSession>();

function getDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveClientSession(
  sessionId: string,
  data: CachedSession,
): Promise<void> {
  if (typeof window === "undefined" || !sessionId) return;

  // 1. In-memory fast path (0ms synchronous access)
  memoryCache.set(sessionId, data);
  const w = window as unknown as Record<string, unknown>;
  w.__vedaClientSession = data;

  // 2. Safe sessionStorage (Store lightweight JSON, strip large images to avoid 5MB quota)
  try {
    sessionStorage.setItem("veda-session-id", sessionId);
    const lightweight = {
      ok: data.ok,
      evaluation: data.evaluation,
      failure: data.failure,
      hasPageImages: Boolean(data.pageImages?.length),
    };
    sessionStorage.setItem(
      `veda-session-data-${sessionId}`,
      JSON.stringify(lightweight),
    );
  } catch {
    // If sessionStorage is full or blocked, ignore — IndexedDB & memory will handle it
  }

  // 3. Persistent IndexedDB for large image arrays (Unlimited quota)
  try {
    const db = await getDb();
    if (db) {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(data, sessionId);
    }
  } catch {
    // IndexedDB fallback
  }
}

export function getClientSessionSync(sessionId: string): CachedSession | null {
  if (typeof window === "undefined" || !sessionId) return null;

  // 1. Check in-memory store
  if (memoryCache.has(sessionId)) {
    return memoryCache.get(sessionId)!;
  }

  const w = window as unknown as Record<string, unknown>;
  if (w.__vedaClientSession && typeof w.__vedaClientSession === "object") {
    return w.__vedaClientSession as CachedSession;
  }

  // 2. Check sessionStorage
  try {
    const raw = sessionStorage.getItem(`veda-session-data-${sessionId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
  }

  return null;
}

export async function getClientSessionAsync(
  sessionId: string,
): Promise<CachedSession | null> {
  const sync = getClientSessionSync(sessionId);
  if (sync?.pageImages && sync.pageImages.length > 0) {
    return sync;
  }

  try {
    const db = await getDb();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(sessionId);
        req.onsuccess = () => {
          if (req.result) {
            memoryCache.set(sessionId, req.result);
            resolve(req.result);
          } else {
            resolve(sync);
          }
        };
        req.onerror = () => resolve(sync);
      });
    }
  } catch {
    // Fallback
  }

  return sync;
}
