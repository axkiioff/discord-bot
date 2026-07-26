/**
 * Per-guild configuration stored in SQLite.
 */
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

// Re-use the same db file as db.ts — open a second handle (SQLite supports multiple readers)
const db = new DatabaseSync(path.join(dataDir, 'bot.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id          TEXT PRIMARY KEY,
    log_channel       TEXT,
    verify_channel    TEXT,
    member_role       TEXT,
    unverified_role   TEXT,
    antinuke_enabled  INTEGER NOT NULL DEFAULT 0,
    antinuke_punishment TEXT NOT NULL DEFAULT 'ban'
  );

  CREATE TABLE IF NOT EXISTS bad_words (
    guild_id TEXT NOT NULL,
    word     TEXT NOT NULL COLLATE NOCASE,
    PRIMARY KEY (guild_id, word)
  );
`);

// Migrate existing tables — add columns if they don't exist yet
for (const sql of [
  "ALTER TABLE guild_config ADD COLUMN antinuke_enabled INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE guild_config ADD COLUMN antinuke_punishment TEXT NOT NULL DEFAULT 'ban'",
]) {
  try { db.exec(sql); } catch { /* column already exists */ }
}

export interface GuildConfig {
  guild_id: string;
  log_channel: string | null;
  verify_channel: string | null;
  member_role: string | null;
  unverified_role: string | null;
  antinuke_enabled: number; // 0 | 1
  antinuke_punishment: string;
}

export function getConfig(guildId: string): GuildConfig | null {
  return (db
    .prepare('SELECT * FROM guild_config WHERE guild_id = :gid')
    .get({ gid: guildId }) as GuildConfig | undefined) ?? null;
}

export function setLogChannel(guildId: string, channelId: string): void {
  db.prepare(`
    INSERT INTO guild_config (guild_id, log_channel)
    VALUES (:gid, :cid)
    ON CONFLICT (guild_id) DO UPDATE SET log_channel = :cid
  `).run({ gid: guildId, cid: channelId });
}

export function setAntiNuke(guildId: string, enabled: boolean, punishment: string): void {
  db.prepare(`
    INSERT INTO guild_config (guild_id, antinuke_enabled, antinuke_punishment)
    VALUES (:gid, :en, :p)
    ON CONFLICT (guild_id) DO UPDATE SET
      antinuke_enabled    = :en,
      antinuke_punishment = :p
  `).run({ gid: guildId, en: enabled ? 1 : 0, p: punishment });
}

export function setVerifyConfig(
  guildId: string,
  verifyChannelId: string,
  memberRoleId: string,
  unverifiedRoleId: string,
): void {
  db.prepare(`
    INSERT INTO guild_config (guild_id, verify_channel, member_role, unverified_role)
    VALUES (:gid, :vc, :mr, :ur)
    ON CONFLICT (guild_id) DO UPDATE SET
      verify_channel  = :vc,
      member_role     = :mr,
      unverified_role = :ur
  `).run({ gid: guildId, vc: verifyChannelId, mr: memberRoleId, ur: unverifiedRoleId });
}

export function getBadWords(guildId: string): Set<string> {
  const rows = db
    .prepare('SELECT word FROM bad_words WHERE guild_id = :gid')
    .all({ gid: guildId }) as Array<{ word: string }>;
  return new Set(rows.map((r) => r.word.toLowerCase()));
}

export function addBadWord(guildId: string, word: string): void {
  db.prepare('INSERT OR IGNORE INTO bad_words (guild_id, word) VALUES (:gid, :w)').run({
    gid: guildId,
    w: word.toLowerCase(),
  });
}

export function removeBadWord(guildId: string, word: string): void {
  db.prepare('DELETE FROM bad_words WHERE guild_id = :gid AND word = :w').run({
    gid: guildId,
    w: word.toLowerCase(),
  });
}
