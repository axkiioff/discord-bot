/**
 * Persistence layer using Node's built-in SQLite (node:sqlite, available in Node 22+).
 * No native compilation required.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'bot.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS usage (
    user_id    TEXT    NOT NULL,
    week_start INTEGER NOT NULL,
    count      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, week_start)
  );

  CREATE TABLE IF NOT EXISTS vip (
    user_id  TEXT PRIMARY KEY,
    added_by TEXT NOT NULL,
    added_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

/** Unix timestamp (seconds) for the most-recent Monday 00:00 UTC. */
function getWeekStart(): number {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0 = Sun
  const daysFromMonday = utcDay === 0 ? 6 : utcDay - 1;
  const monday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysFromMonday,
    ),
  );
  return Math.floor(monday.getTime() / 1000);
}

export function getUsage(userId: string): number {
  const row = db
    .prepare('SELECT count FROM usage WHERE user_id = :uid AND week_start = :ws')
    .get({ uid: userId, ws: getWeekStart() }) as { count: number } | undefined;
  return row?.count ?? 0;
}

export function incrementUsage(userId: string): void {
  db.prepare(`
    INSERT INTO usage (user_id, week_start, count) VALUES (:uid, :ws, 1)
    ON CONFLICT (user_id, week_start) DO UPDATE SET count = count + 1
  `).run({ uid: userId, ws: getWeekStart() });
}

export function isVip(userId: string): boolean {
  return !!db
    .prepare('SELECT 1 FROM vip WHERE user_id = :uid')
    .get({ uid: userId });
}

export function addVip(userId: string, addedBy: string): void {
  db.prepare('INSERT OR IGNORE INTO vip (user_id, added_by) VALUES (:uid, :by)').run({
    uid: userId,
    by: addedBy,
  });
}
