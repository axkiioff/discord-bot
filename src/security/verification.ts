/**
 * Join verification system.
 *
 * Flow:
 *   1. New member joins → bot assigns them the "unverified" role (restricts
 *      access to everything except the verify channel).
 *   2. Bot posts a DM (or message in verify channel) with a "✅ Verify" button.
 *   3. Member clicks the button → bot swaps unverified role for member role.
 *
 * Setup: use /setupverify to configure the verify channel, member role, and
 * unverified role.  The server admin must configure channel permissions so
 * that the unverified role can only see #verify.
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  GuildMember,
  TextChannel,
} from 'discord.js';
import { getConfig } from '../utils/config.js';

const VERIFY_BUTTON_ID = 'verify_member';

export async function onMemberJoinVerification(member: GuildMember): Promise<void> {
  const cfg = getConfig(member.guild.id);
  if (!cfg?.verify_channel || !cfg.member_role || !cfg.unverified_role) return;

  // Assign unverified role
  try {
    await member.roles.add(cfg.unverified_role, 'Pending verification');
  } catch {
    // Bot might not have Manage Roles or role is higher — skip silently
    return;
  }

  // Post verify prompt in the verify channel
  try {
    const ch = await member.guild.channels.fetch(cfg.verify_channel) as TextChannel | null;
    if (!ch) return;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${VERIFY_BUTTON_ID}:${member.id}`)
        .setLabel('✅ I agree to the rules — Verify me')
        .setStyle(ButtonStyle.Success),
    );

    await ch.send({
      content: `👋 Welcome ${member}! Click the button below to gain access to the server.`,
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Blurple)
          .setTitle('Verification Required')
          .setDescription(
            'By clicking Verify, you confirm that you have read and agree to the server rules.',
          )
          .setTimestamp(),
      ],
      components: [row],
    });
  } catch (err) {
    console.error('[verification] failed to post prompt:', err);
  }
}

/** Call this from the InteractionCreate handler for button interactions. */
export async function handleVerifyButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.customId.startsWith(VERIFY_BUTTON_ID + ':')) return;

  const targetId = interaction.customId.split(':')[1];
  if (interaction.user.id !== targetId) {
    await interaction.reply({
      content: '❌ This button is not for you.',
      ephemeral: true,
    });
    return;
  }

  const guild = interaction.guild;
  if (!guild) return;

  const cfg = getConfig(guild.id);
  if (!cfg?.member_role || !cfg.unverified_role) {
    await interaction.reply({
      content: '❌ Verification is not fully configured. Ask an admin to run `/setupverify`.',
      ephemeral: true,
    });
    return;
  }

  const member = interaction.member as GuildMember;

  try {
    await member.roles.remove(cfg.unverified_role, 'Verified');
    await member.roles.add(cfg.member_role, 'Verified');
  } catch (err) {
    console.error('[verification] role swap failed:', err);
    await interaction.reply({
      content: '❌ Could not update your roles. Please ask an admin for help.',
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: '✅ You are now verified! Welcome to the server.',
    ephemeral: true,
  });

  // Remove the verify prompt message so the channel stays clean
  await interaction.message.delete().catch(() => {});
}
