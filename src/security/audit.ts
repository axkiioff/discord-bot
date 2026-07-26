/**
 * Audit log: posts security-relevant events to the configured log channel.
 *
 * Events logged:
 *   - Member join / leave
 *   - Message delete
 *   - Message edit
 *   - Ban / unban
 */
import {
  AuditLogEvent,
  Colors,
  EmbedBuilder,
  Events,
  Guild,
  GuildBan,
  GuildMember,
  Message,
  PartialGuildMember,
  PartialMessage,
  TextChannel,
  time,
  TimestampStyles,
  User,
} from 'discord.js';
import { getConfig } from '../utils/config.js';

async function getLogChannel(guild: Guild): Promise<TextChannel | null> {
  const cfg = getConfig(guild.id);
  if (!cfg?.log_channel) return null;
  try {
    const ch = await guild.channels.fetch(cfg.log_channel);
    return ch instanceof TextChannel ? ch : null;
  } catch {
    return null;
  }
}

async function send(guild: Guild, embed: EmbedBuilder): Promise<void> {
  const ch = await getLogChannel(guild);
  await ch?.send({ embeds: [embed] }).catch(() => {});
}

// ─── event handlers ───────────────────────────────────────────────────────────

export async function onMemberAdd(member: GuildMember): Promise<void> {
  const created = time(
    Math.floor(member.user.createdTimestamp / 1000),
    TimestampStyles.RelativeTime,
  );
  await send(
    member.guild,
    new EmbedBuilder()
      .setColor(Colors.Green)
      .setTitle('📥 Member Joined')
      .setThumbnail(member.user.displayAvatarURL())
      .addFields(
        { name: 'User', value: `${member} (${member.user.username})`, inline: true },
        { name: 'ID', value: member.id, inline: true },
        { name: 'Account created', value: created, inline: true },
      )
      .setTimestamp(),
  );
}

export async function onMemberRemove(
  member: GuildMember | PartialGuildMember,
): Promise<void> {
  // Distinguish kick from voluntary leave by checking audit log
  let action = '📤 Member Left';
  let color: number = Colors.Yellow;

  try {
    const logs = await member.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberKick,
      limit: 1,
    });
    const entry = logs.entries.first();
    if (
      entry &&
      entry.targetId === member.id &&
      Date.now() - entry.createdTimestamp < 5_000
    ) {
      action = '👢 Member Kicked';
      color = Colors.Orange;
    }
  } catch { /* no audit log perms */ }

  await send(
    member.guild,
    new EmbedBuilder()
      .setColor(color)
      .setTitle(action)
      .addFields(
        { name: 'User', value: `${member.user?.username ?? 'Unknown'} (<@${member.id}>)`, inline: true },
        { name: 'ID', value: member.id, inline: true },
      )
      .setTimestamp(),
  );
}

export async function onMessageDelete(
  message: Message | PartialMessage,
): Promise<void> {
  if (!message.guild || message.author?.bot) return;
  if (!message.content && !message.attachments.size) return;

  const embed = new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle('🗑️ Message Deleted')
    .addFields(
      { name: 'Author', value: `${message.author ?? 'Unknown'} (<@${message.author?.id ?? '?'}>)`, inline: true },
      { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
    )
    .setTimestamp();

  if (message.content) {
    embed.addFields({
      name: 'Content',
      value: message.content.slice(0, 1024) || '*(empty)*',
    });
  }
  if (message.attachments.size) {
    embed.addFields({
      name: 'Attachments',
      value: message.attachments.map((a) => a.url).join('\n').slice(0, 1024),
    });
  }

  await send(message.guild, embed);
}

export async function onMessageUpdate(
  oldMsg: Message | PartialMessage,
  newMsg: Message | PartialMessage,
): Promise<void> {
  if (!newMsg.guild || newMsg.author?.bot) return;
  if (oldMsg.content === newMsg.content) return;

  await send(
    newMsg.guild,
    new EmbedBuilder()
      .setColor(Colors.Yellow)
      .setTitle('✏️ Message Edited')
      .addFields(
        { name: 'Author', value: `${newMsg.author ?? 'Unknown'} (<@${newMsg.author?.id ?? '?'}>)`, inline: true },
        { name: 'Channel', value: `<#${newMsg.channelId}>`, inline: true },
        { name: 'Before', value: (oldMsg.content ?? '*(unknown)*').slice(0, 1024) },
        { name: 'After', value: (newMsg.content ?? '*(unknown)*').slice(0, 1024) },
      )
      .setTimestamp(),
  );
}

export async function onBanAdd(ban: GuildBan): Promise<void> {
  await send(
    ban.guild,
    new EmbedBuilder()
      .setColor(Colors.DarkRed)
      .setTitle('🔨 Member Banned')
      .addFields(
        { name: 'User', value: `${ban.user.username} (<@${ban.user.id}>)`, inline: true },
        { name: 'ID', value: ban.user.id, inline: true },
        { name: 'Reason', value: ban.reason ?? 'No reason provided', inline: false },
      )
      .setTimestamp(),
  );
}

export async function onBanRemove(ban: GuildBan): Promise<void> {
  await send(
    ban.guild,
    new EmbedBuilder()
      .setColor(Colors.Blue)
      .setTitle('🔓 Member Unbanned')
      .addFields(
        { name: 'User', value: `${ban.user.username} (<@${ban.user.id}>)`, inline: true },
        { name: 'ID', value: ban.user.id, inline: true },
      )
      .setTimestamp(),
  );
}
