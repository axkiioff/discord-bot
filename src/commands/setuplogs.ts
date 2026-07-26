import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { setLogChannel } from '../utils/config.js';

export const data = new SlashCommandBuilder()
  .setName('setuplogs')
  .setDescription('Set the channel where security audit logs are posted (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((o) =>
    o
      .setName('channel')
      .setDescription('Log channel (defaults to this channel)')
      .setRequired(false),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const ch =
    (interaction.options.getChannel('channel') as TextChannel | null) ??
    (interaction.channel as TextChannel);

  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Must be run in a server.', ephemeral: true });
    return;
  }

  setLogChannel(interaction.guild.id, ch.id);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00e676)
        .setTitle('✅ Audit Log Configured')
        .setDescription(`Security events will now be logged in <#${ch.id}>.`)
        .addFields({
          name: 'Events logged',
          value:
            '📥 Member joins • 📤 Leaves/kicks • 🔨 Bans • 🔓 Unbans • 🗑️ Deleted messages • ✏️ Edited messages',
        })
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}
