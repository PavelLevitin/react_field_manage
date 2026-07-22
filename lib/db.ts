import { promises as fs } from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

export const INITIAL_TEAMS = ['ילדים א', 'נערים א', 'נערים ב', 'ילדים ג', 'שמנים ד', 'שמנים א'];
export const INITIAL_FIELDS = ['וסרמיל 1', 'וסרמיל 2', 'וסרמיל 3', 'וסרמיל 4'];
const TIME_SLOT_COUNT = 3;

type DateSchedule = Record<string, string[][]>;

function emptyFieldSlots(): string[][] {
  return Array.from({ length: TIME_SLOT_COUNT }, () => []);
}

function emptyDateSchedule(fields: string[]): DateSchedule {
  return Object.fromEntries(fields.map(f => [f, emptyFieldSlots()]));
}

type DbShape = {
  teams: string[];
  fields: string[];
  schedules: Record<string, DateSchedule>;
};

function defaultDb(): DbShape {
  return { teams: [...INITIAL_TEAMS], fields: [...INITIAL_FIELDS], schedules: {} };
}

// Old schedules were a flat array of 12 slots (3 time slots x the original 4 fields,
// index = timeSlotIndex * 4 + fieldIndex). Convert those to the new field-keyed shape
// on read so historical dates keep working after fields become editable.
function migrateDateSchedule(value: unknown): DateSchedule {
  if (Array.isArray(value)) {
    const schedule: DateSchedule = {};
    INITIAL_FIELDS.forEach((field, fieldIndex) => {
      schedule[field] = Array.from({ length: TIME_SLOT_COUNT }, (_, timeSlotIndex) =>
        Array.isArray(value[timeSlotIndex * INITIAL_FIELDS.length + fieldIndex])
          ? value[timeSlotIndex * INITIAL_FIELDS.length + fieldIndex]
          : []
      );
    });
    return schedule;
  }
  return (value && typeof value === 'object' ? value : {}) as DateSchedule;
}

async function readDbFile(): Promise<DbShape> {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    const schedules: Record<string, DateSchedule> = {};
    if (parsed.schedules && typeof parsed.schedules === 'object') {
      for (const [date, schedule] of Object.entries(parsed.schedules)) {
        schedules[date] = migrateDateSchedule(schedule);
      }
    }
    return {
      teams: Array.isArray(parsed.teams) ? parsed.teams : [...INITIAL_TEAMS],
      fields: Array.isArray(parsed.fields) ? parsed.fields : [...INITIAL_FIELDS],
      schedules,
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

export async function getFields(): Promise<string[]> {
  const db = await readDbFile();
  return db.fields;
}

export async function getSchedule(date: string): Promise<DateSchedule> {
  const db = await readDbFile();
  return db.schedules[date] ?? emptyDateSchedule(db.fields);
}

export async function getAllSchedules(): Promise<Record<string, DateSchedule>> {
  const db = await readDbFile();
  return db.schedules;
}

export function saveSchedule(date: string, containers: DateSchedule): Promise<void> {
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
      for (const field of Object.keys(db.schedules[date])) {
        db.schedules[date][field] = db.schedules[date][field].map(slot => slot.filter(t => t !== name));
      }
    }
    return db.teams;
  });
}

export function renameTeam(original: string, name: string): Promise<string[]> {
  return withDb(db => {
    if (!db.teams.includes(original) || db.teams.includes(name)) return db.teams;
    db.teams = db.teams.map(t => (t === original ? name : t));
    for (const date of Object.keys(db.schedules)) {
      for (const field of Object.keys(db.schedules[date])) {
        db.schedules[date][field] = db.schedules[date][field].map(slot => slot.map(t => (t === original ? name : t)));
      }
    }
    return db.teams;
  });
}

export function addField(name: string): Promise<string[]> {
  return withDb(db => {
    if (!db.fields.includes(name)) db.fields.push(name);
    return db.fields;
  });
}

export function removeField(name: string): Promise<string[]> {
  return withDb(db => {
    db.fields = db.fields.filter(f => f !== name);
    for (const date of Object.keys(db.schedules)) {
      delete db.schedules[date][name];
    }
    return db.fields;
  });
}

export function renameField(original: string, name: string): Promise<string[]> {
  return withDb(db => {
    if (!db.fields.includes(original) || db.fields.includes(name)) return db.fields;
    db.fields = db.fields.map(f => (f === original ? name : f));
    for (const date of Object.keys(db.schedules)) {
      const schedule = db.schedules[date];
      if (Object.prototype.hasOwnProperty.call(schedule, original)) {
        schedule[name] = schedule[original];
        delete schedule[original];
      }
    }
    return db.fields;
  });
}
