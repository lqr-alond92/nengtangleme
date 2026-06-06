import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const DB_PATH = resolve('server/data/dev-db.json');

const initialData = {
  users: [],
  sessions: [],
  authCodes: [],
  plans: [],
  aiConversations: [],
  aiMessages: [],
  feedback: [],
};

async function ensureDbFile() {
  await mkdir(dirname(DB_PATH), { recursive: true });
  try {
    await readFile(DB_PATH, 'utf8');
  } catch {
    await writeFile(DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

export async function readDb() {
  await ensureDbFile();
  const raw = await readFile(DB_PATH, 'utf8');
  return { ...initialData, ...JSON.parse(raw || '{}') };
}

export async function writeDb(nextDb) {
  await ensureDbFile();
  await writeFile(DB_PATH, JSON.stringify(nextDb, null, 2));
  return nextDb;
}

export async function updateDb(updater) {
  const db = await readDb();
  const nextDb = await updater(db);
  return writeDb(nextDb);
}

export function newId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
