/**
 * Auto-mod: deletes messages containing bad words or Discord invite links.
 * Bad words are stored per-guild in SQLite (see utils/config.ts).
 *
 * Always-blocked patterns (all guilds):
 *   - Discord invite links (discord.gg / discord.com/invite)
 *
 * Guild-customizable:
 *   - Bad-word list (managed with /badword add|remove|list)
 */
import {
  GuildMember,
  Message,
  PermissionFlagsBits,
  TextChannel,
} from 'discord.js';
import { getBadWords } from '../utils/config.js';

const INVITE_REGEX = /discord(?:\.gg|(?:app)?\.com\/invite)\/[\w-]+/i;

export async function handleAutoMod(message: Message): Promise<void> {
  if (!message.guild || message.author.bot) return;

  const member = message.member as GuildMember | null;
  if (!member) return;

  // Skip staff
  if (
    member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  ) return;

  const content = message.content;

  // 1. Invite link check
  if (INVITE_REGEX.test(content)) {
    await deleteAndWarn(message, '🚫 Invite links are not allowed here.');
    return;
  }

  // 2. Bad-word check
  const badWords = getBadWords(message.guild.id);
  if (badWords.size > 0) {
    const lower = content.toLowerCase();
    for (const word of badWords) {
      // Match whole "tokens" so "grass" doesn't trip on "grasshopper"
      const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i');
      if (regex.test(lower)) {
        await deleteAndWarn(message, `🚫 Your message was removed for containing a prohibited word.`);
        return;
      }
    }
  }
}

async function deleteAndWarn(message: Message, warning: string): Promise<void> {
  try {
    await message.delete();
  } catch { /* already deleted */ }

  try {
    const notice = await (message.channel as TextChannel).send(
      `${message.author} ${warning}`,
    );
    setTimeout(() => notice.delete().catch(() => {}), 6_000);
  } catch { /* no perms to send */ }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
