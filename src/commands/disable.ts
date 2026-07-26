import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { setAntiNuke } from '../utils/config.js';

export const data = new SlashCommandBuilder()
  .setName('disable')
  .setDescription('Disable the Anti-Nuke system (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Must be run in a server.', ephemeral: true });
    return;
  }

  setAntiNuke(interaction.guild.id, false, 'ban');

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xff1744)
        .setTitle('🛡️ Anti-Nuke DISABLED')
        .setDescription('Automatic punishments are now **off**. Run `/enable` to turn them back on.')
        .setTimestamp(),
    ],
  });
}
