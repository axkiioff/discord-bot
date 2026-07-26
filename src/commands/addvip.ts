import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { addVip, isVip } from '../utils/db.js';

export const data = new SlashCommandBuilder()
  .setName('addvip')
  .setDescription('Grant a user unlimited /decompile uses (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((o) =>
    o.setName('user').setDescription('User to grant VIP to').setRequired(true),
  );

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const target = interaction.options.getUser('user', true);

  if (isVip(target.id)) {
    await interaction.reply({
      content: `ℹ️ **${target.username}** already has VIP.`,
      ephemeral: true,
    });
    return;
  }

  addVip(target.id, interaction.user.id);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle('⭐ VIP Granted')
        .addFields(
          { name: 'User', value: `<@${target.id}>`, inline: true },
          { name: 'Granted by', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Benefit', value: 'Unlimited `/decompile` per week', inline: false },
        )
        .setTimestamp(),
    ],
    ephemeral: true,
  });

  // Notify the target via DM (best-effort)
  try {
    const dm = await target.createDM();
    await dm.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xffd700)
          .setTitle('⭐ You have been granted VIP!')
          .setDescription(
            'You now have **unlimited** `/decompile` uses every week. No more weekly cap!',
          )
          .setTimestamp(),
      ],
    });
  } catch {
    // User may have DMs disabled — that's fine
  }
}
