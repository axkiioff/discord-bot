import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { setAntiNuke } from '../utils/config.js';

export const data = new SlashCommandBuilder()
  .setName('enable')
  .setDescription('Enable the Anti-Nuke system (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((o) =>
    o
      .setName('punishment')
      .setDescription('What to do when someone nukes')
      .setRequired(true)
      .addChoices(
        { name: '🔨 Ban', value: 'ban' },
        { name: '👢 Kick', value: 'kick' },
        { name: '🎭 Clear Roles', value: 'clear-roles' },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Must be run in a server.', ephemeral: true });
    return;
  }

  const punishment = interaction.options.getString('punishment', true);
  setAntiNuke(interaction.guild.id, true, punishment);

  const punishLabel =
    punishment === 'ban' ? '🔨 Ban' : punishment === 'kick' ? '👢 Kick' : '🎭 Clear Roles';

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00e676)
        .setTitle('🛡️ Anti-Nuke ENABLED')
        .setDescription('The server is now protected. Any of the actions below will trigger an automatic punishment.')
        .addFields(
          {
            name: '⚡ Punishment',
            value: punishLabel,
            inline: true,
          },
          {
            name: '🔒 Protected Actions',
            value: [
              '🗑️ Delete a channel',
              '🤖 Add a bot',
              '🔨 Ban a member',
              '👢 Kick a member',
              '📣 3x @everyone in < 7s → **always ban**',
              '🔗 Invite links → delete only',
            ].join('\n'),
          },
        )
        .setFooter({ text: 'Server owner is always exempt. Bot actions are ignored.' })
        .setTimestamp(),
    ],
  });
}
