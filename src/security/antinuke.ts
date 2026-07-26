/**
 * Anti-nuke system.
 *
 * When enabled (/enable), punishes anyone who:
 *   - Deletes a channel
 *   - Adds a bot
 *   - Bans a member
 *   - Kicks a member
 *   - Sends 3x @everyone/@here in < 7 seconds → ban (always, no config needed)
 *
 * Invite links are handled separately in automod (delete only, no punishment).
 *
 * Punishments: ban | kick | clear-roles
 */
import {
  AuditLogEvent,
  DMChannel,
  Guild,
  GuildChannel,
  GuildMember,
  Message,
  NonThreadGuildBasedChannel,
  PartialGuildMember,
  TextChannel,
} from 'discord.js';
import { getConfig } from '../utils/config.js';

export type Punishment = 'ban' | 'kick' | 'clear-roles';

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Wait ms milliseconds. */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Apply the configured punishment to a user. */
export async function punish(
  guild: Guild,
  userId: string,
  reason: string,
  punishment: Punishment,
): Promise<void> {
  // Never punish the bot itself or the server owner
  if (userId === guild.client.user?.id) return;
  if (userId === guild.ownerId) return;

  const label = `[Anti-Nuke] ${reason}`;

  try {
    switch (punishment) {
      case 'ban':
        await guild.bans.create(userId, { reason: label });
        break;
      case 'kick': {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member) await member.kick(label);
        break;
      }
      case 'clear-roles': {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) break;
        const toRemove = member.roles.cache
          .filter((r) => r.id !== guild.id) // exclude @everyone
          .map((r) => r.id);
        if (toRemove.length) await member.roles.remove(toRemove, label);
        break;
      }
    }

    // Try to log in the audit-log channel
    const cfg = getConfig(guild.id);
    if (cfg?.log_channel) {
      const ch = await guild.channels.fetch(cfg.log_channel).catch(() => null);
      if (ch instanceof TextChannel) {
        await ch
          .send(`🛡️ **Anti-Nuke** — <@${userId}> was **${punishment}**ed: ${reason}`)
          .catch(() => {});
      }
    }
  } catch (err) {
    console.error('[anti-nuke] punish failed:', err);
  }
}

/** Fetch the latest audit log entry for a given action (within 3 s). */
async function getExecutor(
  guild: Guild,
  type: AuditLogEvent,
): Promise<string | null> {
  await sleep(1200); // let Discord populate the audit log
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 1 });
    const entry = logs.entries.first();
    if (!entry) return null;
    if (Date.now() - entry.createdTimestamp > 5_000) return null;
    return entry.executor?.id ?? null;
  } catch {
    return null;
  }
}

// ─── event handlers ───────────────────────────────────────────────────────────

export async function onChannelDelete(
  channel: DMChannel | NonThreadGuildBasedChannel,
): Promise<void> {
  if (!('guild' in channel)) return;
  const cfg = getConfig(channel.guild.id);
  if (!cfg?.antinuke_enabled) return;

  const executorId = await getExecutor(channel.guild, AuditLogEvent.ChannelDelete);
  if (!executorId) return;

  await punish(
    channel.guild,
    executorId,
    `Deleted channel "${(channel as GuildChannel).name}"`,
    cfg.antinuke_punishment as Punishment,
  );
}

export async function onBotAdd(member: GuildMember | PartialGuildMember): Promise<void> {
  if (!member.user?.bot) return;
  const cfg = getConfig(member.guild.id);
  if (!cfg?.antinuke_enabled) return;

  const executorId = await getExecutor(member.guild, AuditLogEvent.BotAdd);
  if (!executorId) return;

  await punish(
    member.guild,
    executorId,
    `Added bot ${member.user.username}`,
    cfg.antinuke_punishment as Punishment,
  );
}

export async function onUnauthorizedBan(guild: Guild, bannedUserId: string): Promise<void> {
  const cfg = getConfig(guild.id);
  if (!cfg?.antinuke_enabled) return;

  const executorId = await getExecutor(guild, AuditLogEvent.MemberBanAdd);
  if (!executorId) return;
  if (executorId === guild.client.user?.id) return; // bot's own ban action

  await punish(
    guild,
    executorId,
    `Banned member <@${bannedUserId}>`,
    cfg.antinuke_punishment as Punishment,
  );
}

export async function onUnauthorizedKick(
  member: GuildMember | PartialGuildMember,
): Promise<void> {
  const cfg = getConfig(member.guild.id);
  if (!cfg?.antinuke_enabled) return;

  const executorId = await getExecutor(member.guild, AuditLogEvent.MemberKick);
  if (!executorId) return;
  if (executorId === member.guild.client.user?.id) return; // bot's own kick action

  await punish(
    member.guild,
    executorId,
    `Kicked member ${member.user?.username ?? member.id}`,
    cfg.antinuke_punishment as Punishment,
  );
}

// ─── @everyone spam (always active when antinuke is on) ───────────────────────

const everyoneLog = new Map<string, number[]>(); // `guildId:userId` → timestamps

export async function onEveryonePing(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;
  if (!message.mentions.everyone) return;

  const cfg = getConfig(message.guild.id);
  if (!cfg?.antinuke_enabled) return;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const times = (everyoneLog.get(key) ?? []).filter((t) => now - t < 7_000);
  times.push(now);
  everyoneLog.set(key, times);

  // Always delete the ping message
  await message.delete().catch(() => {});

  if (times.length >= 3) {
    everyoneLog.delete(key);
    await punish(
      message.guild,
      message.author.id,
      '3x @everyone ping in under 7 seconds',
      'ban', // always ban for mass ping — override config
    );
  }
}
