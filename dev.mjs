import { createServer } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = await createServer({
  root: __dirname,
  configFile: resolve(__dirname, 'vite.config.js'),
  server: { host: true },
});
await server.listen();
server.printUrls();

// Keep the process alive
process.stdin.resume();
