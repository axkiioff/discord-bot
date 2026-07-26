import {
  ButtonInteraction,
  Client,
  Collection,
  Events,
  GatewayIntentBits,
  GuildBan,
  GuildMember,
  Partials,
  PartialGuildMember,
  type ChatInputCommandInteraction,
} from 'discord.js';
import * as addvipCmd from './commands/addvip.js';
import * as badwordCmd from './commands/badword.js';
import * as decompileCmd from './commands/decompile.js';
import * as disableCmd from './commands/disable.js';
import * as enableCmd from './commands/enable.js';
import * as setuplogsCmd from './commands/setuplogs.js';
import * as setupverifyCmd from './commands/setupverify.js';
import {
  onBanAdd,
  onBanRemove,
  onMemberAdd as onMemberAddAudit,
  onMemberRemove as onMemberRemoveAudit,
  onMessageDelete,
  onMessageUpdate,
} from './security/audit.js';
import {
  onBotAdd,
  onChannelDelete,
  onEveryonePing,
  onUnauthorizedBan,
  onUnauthorizedKick,
} from './security/antinuke.js';
import { handleAutoMod } from './security/automod.js';
import { handleAntiSpam } from './security/spam.js';
import {
  handleVerifyButton,
  onMemberJoinVerification,
} from './security/verification.js';

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('Missing DISCORD_TOKEN environment variable.');

// ─── command registry ─────────────────────────────────────────────────────────

interface Command {
  data: { name: string; toJSON(): object };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}

const commands = new Collection<string, Command>();
for (const cmd of [
  decompileCmd,
  addvipCmd,
  setuplogsCmd,
  setupverifyCmd,
  badwordCmd,
  enableCmd,
  disableCmd,
]) {
  commands.set(cmd.data.name, cmd);
}

// ─── client ───────────────────────────────────────────────────────────────────

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,       // privileged — enable in Dev Portal
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,     // privileged — enable in Dev Portal
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// ─── ready ────────────────────────────────────────────────────────────────────

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Bot online as ${c.user.tag}`);
});

// ─── slash commands + buttons ─────────────────────────────────────────────────

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    await handleVerifyButton(interaction as ButtonInteraction).catch(console.error);
    return;
  }
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[/${interaction.commandName}]`, err);
    const payload = { content: '❌ An unexpected error occurred.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
});

// ─── member join ──────────────────────────────────────────────────────────────

client.on(Events.GuildMemberAdd, async (member) => {
  await Promise.all([
    onMemberAddAudit(member as GuildMember).catch(console.error),
    onMemberJoinVerification(member as GuildMember).catch(console.error),
    onBotAdd(member).catch(console.error), // anti-nuke: bot added
  ]);
});

// ─── member remove (leave / kick) ─────────────────────────────────────────────

client.on(Events.GuildMemberRemove, async (member) => {
  await Promise.all([
    onMemberRemoveAudit(member).catch(console.error),
    onUnauthorizedKick(member).catch(console.error), // anti-nuke: kick
  ]);
});

// ─── bans ────────────────────────────────────────────────────────────────────

client.on(Events.GuildBanAdd, async (ban: GuildBan) => {
  await Promise.all([
    onBanAdd(ban).catch(console.error),
    onUnauthorizedBan(ban.guild, ban.user.id).catch(console.error), // anti-nuke: ban
  ]);
});

client.on(Events.GuildBanRemove, (ban) => onBanRemove(ban).catch(console.error));

// ─── channel delete (anti-nuke) ───────────────────────────────────────────────

client.on(Events.ChannelDelete, (ch) => onChannelDelete(ch).catch(console.error));

// ─── messages ────────────────────────────────────────────────────────────────

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  await Promise.all([
    handleAntiSpam(message).catch(console.error),
    handleAutoMod(message).catch(console.error),
    onEveryonePing(message).catch(console.error), // anti-nuke: @everyone spam
  ]);
});

client.on(Events.MessageDelete, (msg) => onMessageDelete(msg).catch(console.error));
client.on(Events.MessageUpdate, (old, next) =>
  onMessageUpdate(old, next).catch(console.error),
);

// ─── login ────────────────────────────────────────────────────────────────────

await client.login(token);
