/**
 * Anti-spam: tracks message timestamps per user and times them out if they
 * exceed the thresholds.
 *
 * Thresholds:
 *   ≥ 5 messages in 5 s  → 5-minute timeout
 *   ≥ 10 messages in 10 s → 1-hour timeout
 */
import {
  GuildMember,
  Message,
  PermissionFlagsBits,
  TextChannel,
  time,
  TimestampStyles,
} from 'discord.js';

// userId → array of message timestamps (ms)
const messageLog = new Map<string, number[]>();

const WINDOW_SHORT = 5_000;   // 5 s
const LIMIT_SHORT  = 5;       // 5 msgs → 5-min timeout
const WINDOW_LONG  = 10_000;  // 10 s
const LIMIT_LONG   = 10;      // 10 msgs → 1-hr timeout

const TIMEOUT_SHORT = 5 * 60;         // seconds
const TIMEOUT_LONG  = 60 * 60;        // seconds

export async function handleAntiSpam(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;

  const member = message.member as GuildMember | null;
  if (!member) return;

  // Don't touch admins / moderators
  if (
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  ) return;

  const key = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();

  // Append and prune old timestamps
  const timestamps = (messageLog.get(key) ?? []).filter((t) => now - t < WINDOW_LONG);
  timestamps.push(now);
  messageLog.set(key, timestamps);

  const inShort = timestamps.filter((t) => now - t < WINDOW_SHORT).length;
  const inLong  = timestamps.length;

  let timeoutSeconds = 0;
  let reason = '';

  if (inLong >= LIMIT_LONG) {
    timeoutSeconds = TIMEOUT_LONG;
    reason = `Spam: ${inLong} messages in 10 seconds`;
  } else if (inShort >= LIMIT_SHORT) {
    timeoutSeconds = TIMEOUT_SHORT;
    reason = `Spam: ${inShort} messages in 5 seconds`;
  }

  if (timeoutSeconds === 0) return;

  // Clear their log so we don't re-trigger immediately on resume
  messageLog.delete(key);

  try {
    await member.timeout(timeoutSeconds * 1000, reason);

    const until = time(
      Math.floor(Date.now() / 1000) + timeoutSeconds,
      TimestampStyles.RelativeTime,
    );
    await (message.channel as TextChannel)
      .send({
        content: `🔇 ${member} has been timed out for spam. They can speak again ${until}.`,
      })
      .catch(() => {});
  } catch (err) {
    console.error('[anti-spam] timeout failed:', err);
  }
}
