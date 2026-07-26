import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  Role,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { setVerifyConfig } from '../utils/config.js';

export const data = new SlashCommandBuilder()
  .setName('setupverify')
  .setDescription('Configure join verification (admin only)')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption((o) =>
    o
      .setName('verify-channel')
      .setDescription('Channel where the verify button is posted')
      .setRequired(true),
  )
  .addRoleOption((o) =>
    o
      .setName('member-role')
      .setDescription('Role given to users after verification')
      .setRequired(true),
  )
  .addRoleOption((o) =>
    o
      .setName('unverified-role')
      .setDescription('Role assigned on join (restricts channel access)')
      .setRequired(true),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: '❌ Must be run in a server.', ephemeral: true });
    return;
  }

  const verifyCh = interaction.options.getChannel('verify-channel', true) as TextChannel;
  const memberRole = interaction.options.getRole('member-role', true) as Role;
  const unverifiedRole = interaction.options.getRole('unverified-role', true) as Role;

  setVerifyConfig(
    interaction.guild.id,
    verifyCh.id,
    memberRole.id,
    unverifiedRole.id,
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x00e676)
        .setTitle('✅ Verification Configured')
        .addFields(
          { name: '📢 Verify channel', value: `<#${verifyCh.id}>`, inline: true },
          { name: '✅ Member role', value: `<@&${memberRole.id}>`, inline: true },
          { name: '🔒 Unverified role', value: `<@&${unverifiedRole.id}>`, inline: true },
        )
        .addFields({
          name: '⚠️ Important — channel permissions',
          value: [
            `Make sure **<@&${unverifiedRole.id}>** can **only** see <#${verifyCh.id}>.`,
            'In your other channels, set **<@&' + unverifiedRole.id + '>** → View Channel: ❌',
          ].join('\n'),
        })
        .setTimestamp(),
    ],
    ephemeral: true,
  });
}
