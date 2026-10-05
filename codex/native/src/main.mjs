import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {readFileSync} from 'node:fs';
import {createServer} from './server.mjs';
const html=readFileSync(new URL('./panel.html',import.meta.url),'utf8');
await createServer(html).connect(new StdioServerTransport());
