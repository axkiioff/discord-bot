import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { addBadWord, getBadWords, removeBadWord } from '../utils/config.js';

export const data = new SlashCommandBuilder()
  .setName('badword')
  .setDescription('Manage the auto-mod word filter (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addSubcommand((s) =>
    s
      .setName('add')
      .setDescription('Add a word to the filter')
      .addStringOption((o) =>
        o.setName('word').setDescription('Word to block').setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('remove')
      .setDescription('Remove a word from the filter')
      .addStringOption((o) =>
        o.setName('word').setDescription('Word to unblock').setRequired(true),
      ),
  )
  .addSubcommand((s) => s.setName('list').setDescription('Show all filtered words'));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Must be run in a server.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const word = interaction.options.getString('word', true).trim();
    addBadWord(interaction.guild.id, word);
    await interaction.reply({ content: `✅ Added **${word}** to the filter.`, ephemeral: true });
  } else if (sub === 'remove') {
    const word = interaction.options.getString('word', true).trim();
    removeBadWord(interaction.guild.id, word);
    await interaction.reply({ content: `✅ Removed **${word}** from the filter.`, ephemeral: true });
  } else {
    const words = [...getBadWords(interaction.guild.id)];
    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865f2)
          .setTitle('🚫 Filtered Words')
          .setDescription(
            words.length ? words.map((w) => `\`${w}\``).join(', ') : '*No words filtered yet.*',
          ),
      ],
      ephemeral: true,
    });
  }
}
