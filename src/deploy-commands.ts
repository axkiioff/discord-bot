import { REST, Routes } from 'discord.js';
import { data as addvipData } from './commands/addvip.js';
import { data as badwordData } from './commands/badword.js';
import { data as decompileData } from './commands/decompile.js';
import { data as disableData } from './commands/disable.js';
import { data as enableData } from './commands/enable.js';
import { data as setuplogsData } from './commands/setuplogs.js';
import { data as setupverifyData } from './commands/setupverify.js';

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token) throw new Error('Missing DISCORD_TOKEN env var');
if (!clientId) throw new Error('Missing DISCORD_CLIENT_ID env var');

const rest = new REST({ version: '10' }).setToken(token);

const body = [
  decompileData.toJSON(),
  addvipData.toJSON(),
  setuplogsData.toJSON(),
  setupverifyData.toJSON(),
  badwordData.toJSON(),
  enableData.toJSON(),
  disableData.toJSON(),
];

console.log(`Registering ${body.length} slash commands globally…`);
await rest.put(Routes.applicationCommands(clientId), { body });
console.log('✅ Done. Commands may take up to 1 hour to appear globally.');
