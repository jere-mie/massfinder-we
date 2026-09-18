import initSqlJs, { type Database } from 'sql.js';
import {
  queryChurches,
  queryEventFamilies,
  queryEvents,
  queryIntentionChurchIds,
  queryIntentions,
  type EventQueryFilters,
  type IntentionQueryFilters,
} from './databaseQueries';

const DATABASE_SCHEMA_VERSION = 1;
const MAX_QUERY_CACHE_ENTRIES = 32;

let databasePromise: Promise<Database> | undefined;
const queryCache = new Map<string, Promise<unknown>>();

async function openDatabase(): Promise<Database> {
  const [SQL, response] = await Promise.all([
    initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    }),
    fetch('/massfinder.db', { cache: 'no-cache' }),
  ]);
  if (!response.ok) {
    throw new Error(`Unable to load SQLite database (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const database = new SQL.Database(bytes);
  const versionResult = database.exec('PRAGMA user_version');
  const version = Number(versionResult[0]?.values[0]?.[0] ?? 0);
  if (version !== DATABASE_SCHEMA_VERSION) {
    database.close();
    throw new Error(
      `Unsupported SQLite database schema version ${version}; expected ${DATABASE_SCHEMA_VERSION}`,
    );
  }
  return database;
}

function getDatabase(): Promise<Database> {
  databasePromise ??= openDatabase().catch((error: unknown) => {
    // A transient fetch/WASM failure should be retryable after the user
    // reloads or the network becomes available again.
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

function cachedQuery<T>(key: string, query: () => Promise<T>): Promise<T> {
  const cached = queryCache.get(key) as Promise<T> | undefined;
  if (cached) {
    queryCache.delete(key);
    queryCache.set(key, cached);
    return cached;
  }

  const pending = query().catch((error: unknown) => {
    queryCache.delete(key);
    throw error;
  });
  queryCache.set(key, pending);
  while (queryCache.size > MAX_QUERY_CACHE_ENTRIES) {
    const oldestKey = queryCache.keys().next().value;
    if (oldestKey === undefined) break;
    queryCache.delete(oldestKey);
  }
  return pending;
}

export async function loadChurches(): Promise<ReturnType<typeof queryChurches>> {
  return (await cachedQuery('churches', async () => queryChurches(await getDatabase()))).slice();
}

export async function loadEvents(
  filters: EventQueryFilters = {},
): Promise<ReturnType<typeof queryEvents>> {
  return (await cachedQuery(`events:${JSON.stringify(filters)}`, async () =>
    queryEvents(await getDatabase(), filters),
  )).slice();
}

export async function loadIntentions(
  filters: IntentionQueryFilters = {},
): Promise<ReturnType<typeof queryIntentions>> {
  return (await cachedQuery(`intentions:${JSON.stringify(filters)}`, async () =>
    queryIntentions(await getDatabase(), filters),
  )).slice();
}

export async function loadEventFamilies(): Promise<ReturnType<typeof queryEventFamilies>> {
  return (await cachedQuery('event-families', async () => queryEventFamilies(await getDatabase()))).slice();
}

export async function loadIntentionChurchIds(): Promise<ReturnType<typeof queryIntentionChurchIds>> {
  return (await cachedQuery('intention-church-ids', async () =>
    queryIntentionChurchIds(await getDatabase()),
  )).slice();
}
