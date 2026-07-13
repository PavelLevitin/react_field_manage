import { promises as fs } from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

export const INITIAL_TEAMS = ['ילדים א', 'נערים א', 'נערים ב', 'ילדים ג', 'שמנים ד', 'שמנים א'];
const SLOT_COUNT = 12;

function emptySchedule(): string[][] {
  return Array.from({ length: SLOT_COUNT }, () => []);
}

type DbShape = {
  teams: string[];
  schedules: Record<string, string[][]>;
};

function defaultDb(): DbShape {
  return { teams: [...INITIAL_TEAMS], schedules: {} };
}

async function readDbFile(): Promise<DbShape> {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    return {
      teams: Array.isArray(parsed.teams) ? parsed.teams : [...INITIAL_TEAMS],
      schedules: parsed.schedules && typeof parsed.schedules === 'object' ? parsed.schedules : {},
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return defaultDb();
    throw err;
  }
}

async function writeDbFile(db: DbShape) {
  await fs.mkdir(DB_DIR, { recursive: true });
  const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  await fs.rename(tmpFile, DB_FILE);
}

// Serializes all read-modify-write operations so concurrent requests
// (e.g. two devices editing at once) can't clobber each other's writes.
let queue: Promise<unknown> = Promise.resolve();

function withDb<T>(mutator: (db: DbShape) => T): Promise<T> {
  const result = queue.then(async () => {
    const db = await readDbFile();
    const value = mutator(db);
    await writeDbFile(db);
    return value;
  });
  queue = result.catch(() => {});
  return result;
}

export async function getTeams(): Promise<string[]> {
  const db = await readDbFile();
  return db.teams;
}

export async function getSchedule(date: string): Promise<string[][]> {
  const db = await readDbFile();
  return db.schedules[date] ?? emptySchedule();
}

export function saveSchedule(date: string, containers: string[][]): Promise<void> {
  return withDb(db => {
    db.schedules[date] = containers;
  });
}

export function addTeam(name: string): Promise<string[]> {
  return withDb(db => {
    if (!db.teams.includes(name)) db.teams.push(name);
    return db.teams;
  });
}

export function removeTeam(name: string): Promise<string[]> {
  return withDb(db => {
    db.teams = db.teams.filter(t => t !== name);
    for (const date of Object.keys(db.schedules)) {
      db.schedules[date] = db.schedules[date].map(slot => slot.filter(t => t !== name));
    }
    return db.teams;
  });
}

export function renameTeam(original: string, name: string): Promise<string[]> {
  return withDb(db => {
    if (!db.teams.includes(original) || db.teams.includes(name)) return db.teams;
    db.teams = db.teams.map(t => (t === original ? name : t));
    for (const date of Object.keys(db.schedules)) {
      db.schedules[date] = db.schedules[date].map(slot => slot.map(t => (t === original ? name : t)));
    }
    return db.teams;
  });
}
