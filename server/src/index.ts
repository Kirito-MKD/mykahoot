import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerInfo, ServerToClientEvents } from '@viktorina/shared';
import { GameManager } from './game/manager';
import { buildServerInfo, getLanAddresses, printBanner, startMdns, writeShortcuts, MDNS_HOST, type MdnsHandle } from './network';
import { CLIENT_DIST, UPLOADS_DIR } from './paths';
import { createApiRouter } from './routes';
import { registerSockets } from './sockets';
import { seedDemoQuiz } from './seed';

function readPort(): number {
  const arg = process.argv.find((a) => a.startsWith('--port='));
  const fromArg = arg ? Number(arg.split('=')[1]) : NaN;
  const fromEnv = Number(process.env.PORT);
  const port = Number.isFinite(fromArg) ? fromArg : Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 3000;
  return port;
}

const PORT = readPort();
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));

let info: ServerInfo = {
  port: PORT,
  mdnsOk: false,
  mdnsUrl: `http://${MDNS_HOST}:${PORT}`,
  ipUrls: [],
  primaryUrl: `http://localhost:${PORT}`,
  qrUrl: `http://localhost:${PORT}`,
  qrDataUrl: '',
  shortcutPath: null,
};

app.use('/api', createApiRouter(() => info));
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d', immutable: true }));

const hasClient = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));
if (hasClient) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
  // Одностраничное приложение: все остальные адреса отдают index.html
  app.get(/^\/(?!api\/|uploads\/|socket\.io\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res
      .status(503)
      .type('text/plain; charset=utf-8')
      .send('Клиент ещё не собран. Запустите «npm start» (соберёт и запустит) или «npm run dev» и откройте http://localhost:5173');
  });
}

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  // Длинные паузы между событиями — норма (преподаватель объясняет ответ); держим соединение живым
  pingInterval: 10_000,
  pingTimeout: 20_000,
  maxHttpBufferSize: 1e6,
});
const manager = new GameManager(io);
registerSockets(io, manager);

let mdns: MdnsHandle | null = null;

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n✖ Порт ${PORT} уже занят. Возможно, викторина уже запущена в другом окне.`);
    console.error(`  Закройте её или запустите на другом порту: npm start -- --port=3001\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', async () => {
  try {
    await seedDemoQuiz();
  } catch (err) {
    console.warn('⚠  Не удалось добавить демо-тест:', err instanceof Error ? err.message : err);
  }
  const addrs = getLanAddresses();
  const preferred = addrs.filter((a) => !a.virtual).map((a) => a.address);
  mdns = await startMdns(PORT, preferred.length ? preferred : addrs.map((a) => a.address));
  const mdnsUrl = `http://${MDNS_HOST}:${PORT}/`;
  const ipUrl = addrs[0] ? `http://${addrs[0].address}:${PORT}/` : null;
  const shortcut = writeShortcuts(mdns.ok ? mdnsUrl : (ipUrl ?? mdnsUrl), ipUrl);
  info = await buildServerInfo(PORT, mdns.ok, shortcut);
  printBanner(info);
  if (!hasClient) console.log('ℹ  Клиент не собран: для разработки откройте http://localhost:5173 (npm run dev)\n');
});

// Адреса могут поменяться (ноутбук переподключился к другой сети) — обновляем раз в 30 секунд
setInterval(async () => {
  const fresh = getLanAddresses().map((a) => `http://${a.address}:${PORT}`);
  if (fresh.join() !== info.ipUrls.join()) {
    info = await buildServerInfo(PORT, mdns?.ok ?? false, info.shortcutPath);
    console.log('ℹ  Сетевые адреса изменились:', info.ipUrls.join(', ') || 'нет сети');
  }
}, 30_000).unref();

function shutdown() {
  console.log('\nОстанавливаю сервер…');
  mdns?.stop();
  io.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
