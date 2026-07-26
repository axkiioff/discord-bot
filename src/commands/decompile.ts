import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import JSZip from 'jszip';
import { getUsage, incrementUsage, isVip } from '../utils/db.js';
import { uploadToGofile } from '../utils/gofile.js';
import { parseRbxl, type ParseResult } from '../utils/rbxl-parser.js';

const MAX_USES = 10;

export const data = new SlashCommandBuilder()
  .setName('decompile')
  .setDescription('Analyze a Roblox place file (.rbxl / .rbxlx) that you own')
  .addAttachmentOption((o) =>
    o
      .setName('file')
      .setDescription('Your .rbxl or .rbxlx place file')
      .setRequired(true),
  );

// ─── progress bar embed ───────────────────────────────────────────────────────

function progressEmbed(percent: number, status: string): EmbedBuilder {
  const filled = Math.round(percent / 5);
  const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🔧 Decompiling Roblox Place File')
    .setDescription(`${status}\n\n\`[${bar}]\` **${percent}%**`)
    .setFooter({ text: 'Results will appear here when complete.' })
    .setTimestamp();
}

// ─── analysis text file ───────────────────────────────────────────────────────

function buildAnalysis(result: ParseResult, filename: string): string {
  const lines = [
    'ROBLOX PLACE FILE ANALYSIS',
    `File: ${filename}`,
    `Date: ${new Date().toUTCString()}`,
    '',
    '=== SUMMARY ===',
    `Total Instances : ${result.totalInstances}`,
    `Models          : ${result.modelCount}`,
    `Parts           : ${result.partCount}`,
    `Scripts         : ${result.scripts.length}`,
    `Assets          : ${result.assetCount}`,
    '',
    '=== SCRIPTS ===',
    ...result.scripts.map(
      (s) =>
        `[${s.scriptType}] ${s.name}  (${s.source.split('\n').length} lines)`,
    ),
  ];
  return lines.join('\n');
}

// ─── command handler ──────────────────────────────────────────────────────────

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const userId = interaction.user.id;
  const vip = isVip(userId);

  // Rate-limit check
  if (!vip && getUsage(userId) >= MAX_USES) {
    await interaction.reply({
      content: [
        `❌ You've used all **${MAX_USES}** weekly decompiles. Resets every Monday.`,
        'Ask a server administrator to grant you VIP for unlimited access.',
      ].join('\n'),
      ephemeral: true,
    });
    return;
  }

  // File type check
  const attachment = interaction.options.getAttachment('file', true);
  const name = attachment.name.toLowerCase();
  if (!name.endsWith('.rbxl') && !name.endsWith('.rbxlx')) {
    await interaction.reply({
      content: '❌ Please upload a `.rbxl` or `.rbxlx` Roblox place file.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // Open DM channel first
  let dm;
  try {
    dm = await interaction.user.createDM();
  } catch {
    await interaction.editReply(
      '❌ I could not DM you. Enable DMs from server members and try again.',
    );
    return;
  }

  const progressMsg = await dm.send({
    embeds: [progressEmbed(1, '📥 Starting decompile...')],
  });

  const update = async (pct: number, status: string) => {
    try {
      await progressMsg.edit({ embeds: [progressEmbed(pct, status)] });
    } catch { /* ignore edit races */ }
  };

  try {
    // 1. Download
    await update(10, '📥 Downloading your place file...');
    const res = await fetch(attachment.url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error('Failed to download file from Discord.');
    const xmlContent = await res.text();

    // 2. Parse
    await update(30, '🔍 Parsing XML structure...');
    const result = parseRbxl(xmlContent);

    // 3. Extract scripts
    await update(55, `📜 Extracted ${result.scripts.length} script(s)...`);

    // 4. Build zip
    await update(70, '📦 Building archive...');
    const zip = new JSZip();

    // Include the original place file
    zip.file(attachment.name, xmlContent);

    // Scripts as .lua files
    const scriptsFolder = zip.folder('scripts')!;
    for (const script of result.scripts) {
      const ext =
        script.scriptType === 'LocalScript'
          ? '.client.lua'
          : script.scriptType === 'ModuleScript'
            ? '.module.lua'
            : '.server.lua';
      const safeName = script.name.replace(/[^a-zA-Z0-9_.\- ]/g, '_');
      scriptsFolder.file(`${safeName}${ext}`, script.source);
    }

    // Analysis summary
    zip.file('analysis.txt', buildAnalysis(result, attachment.name));

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // 5. Upload to Gofile
    await update(88, '☁️ Uploading to Gofile...');
    const baseName = attachment.name.replace(/\.[^.]+$/, '');
    const gofileUrl = await uploadToGofile(zipBuffer, `${baseName}_decompiled.zip`);

    // 6. Increment usage (only after success)
    incrementUsage(userId);
    const usageStr = isVip(userId)
      ? '∞  (VIP — unlimited)'
      : `${getUsage(userId)} / ${MAX_USES} this week`;

    await update(100, '✅ Done!');

    await progressMsg.edit({
      embeds: [
        new EmbedBuilder()
          .setColor(0x00e676)
          .setTitle('✅ Decompile Complete')
          .addFields(
            {
              name: '📊 Analysis',
              value: [
                `🧩 Models  **${result.modelCount}**`,
                `🧱 Parts   **${result.partCount}**`,
                `📜 Scripts **${result.scripts.length}**`,
                `🖼️ Assets  **${result.assetCount}**`,
                `📦 Total instances **${result.totalInstances}**`,
              ].join('\n'),
            },
            {
              name: '📁 Download',
              value: `[Click to open on Gofile](${gofileUrl})\n\nContains: original place file + \`scripts/\` folder + \`analysis.txt\``,
            },
            { name: '📈 Weekly uses', value: usageStr, inline: true },
          )
          .setFooter({ text: 'Only visible to you.' })
          .setTimestamp(),
      ],
    });

    await interaction.editReply('✅ Done! Check your DMs for the download link.');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[decompile]', err);

    await progressMsg
      .edit({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff1744)
            .setTitle('❌ Decompile Failed')
            .setDescription(`\`\`\`${msg}\`\`\``)
            .setTimestamp(),
        ],
      })
      .catch(() => {});

    await interaction.editReply('❌ Something went wrong. See your DMs for details.').catch(() => {});
  }
}
