import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import QRCode from 'qrcode';
import { Bonjour } from 'bonjour-service';
import type { ServerInfo } from '@viktorina/shared';
import { SHORTCUTS_DIR } from './paths';

export const MDNS_NAME = 'viktorina';
export const MDNS_HOST = `${MDNS_NAME}.local`;

const VIRTUAL_IFACE = /(vethernet|virtualbox|vmware|vbox|docker|br-|veth|wsl|hyper-v|loopback|tailscale|zerotier|utun|tun|tap|vpn|hamachi)/i;

export interface LanAddress {
  address: string;
  iface: string;
  virtual: boolean;
}

function isPrivate(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

/** Все IPv4-адреса машины в локальных сетях, самые вероятные — первыми */
export function getLanAddresses(): LanAddress[] {
  const list: LanAddress[] = [];
  for (const [iface, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (a.address.startsWith('169.254.')) continue; // нет DHCP — адрес бесполезен
      list.push({ address: a.address, iface, virtual: VIRTUAL_IFACE.test(iface) });
    }
  }
  const score = (a: LanAddress) =>
    (a.virtual ? 100 : 0) + (a.address.startsWith('192.168.') ? 0 : a.address.startsWith('10.') ? 1 : isPrivate(a.address) ? 2 : 5);
  return list.sort((a, b) => score(a) - score(b));
}

export interface MdnsHandle {
  ok: boolean;
  stop: () => void;
}

/** Публикует сервер в сети как viktorina.local. Никогда не бросает исключений. */
export function startMdns(port: number, preferred: string[]): Promise<MdnsHandle> {
  return new Promise((resolve) => {
    let settled = false;
    let bonjour: Bonjour | null = null;
    const done = (ok: boolean, reason?: string) => {
      if (settled) return;
      settled = true;
      if (!ok) {
        console.warn(`⚠  mDNS не поднялся (${reason ?? 'неизвестная причина'}). Дети смогут зайти по IP-адресу.`);
        try {
          bonjour?.destroy();
        } catch {
          /* ignore */
        }
      }
      resolve({
        ok,
        stop: () => {
          try {
            bonjour?.unpublishAll(() => bonjour?.destroy());
          } catch {
            /* ignore */
          }
        },
      });
    };

    try {
      bonjour = new Bonjour({}, (err: unknown) => done(false, err instanceof Error ? err.message : String(err)));
      const mdns = (bonjour as unknown as { server: { mdns: NodeJS.EventEmitter } }).server.mdns;
      mdns.on('error', (err: Error) => done(false, err.message));
      const service = bonjour.publish({
        name: MDNS_NAME,
        type: 'http',
        port,
        host: MDNS_HOST,
        txt: { path: '/' },
        disableIPv6: true,
      });
      // Отвечаем только «настоящими» адресами, без виртуальных адаптеров (VirtualBox, WSL, VPN…)
      const original = service.records.bind(service);
      service.records = () =>
        original().filter((r) => r.type !== 'A' || preferred.length === 0 || preferred.includes(String(r.data)));
      service.on('up', () => done(true));
      service.on('error', (err: Error) => done(false, err.message));
      setTimeout(() => done(false, 'имя viktorina уже занято в сети или multicast заблокирован'), 4000).unref();
    } catch (err) {
      done(false, err instanceof Error ? err.message : String(err));
    }
  });
}

/** Ярлыки Windows (Internet Shortcut). Преподаватель копирует их на рабочие столы классных ПК. */
export function writeShortcuts(mdnsUrl: string, ipUrl: string | null): string | null {
  try {
    fs.mkdirSync(SHORTCUTS_DIR, { recursive: true });
    const make = (url: string) => `[InternetShortcut]\r\nURL=${url}\r\nIconIndex=0\r\n`;
    const main = path.join(SHORTCUTS_DIR, 'Викторина.url');
    fs.writeFileSync(main, make(mdnsUrl));
    if (ipUrl) fs.writeFileSync(path.join(SHORTCUTS_DIR, 'Викторина (по IP-адресу).url'), make(ipUrl));
    return main;
  } catch (err) {
    console.warn('⚠  Не удалось записать ярлыки:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function buildServerInfo(port: number, mdnsOk: boolean, shortcutPath: string | null): Promise<ServerInfo> {
  const addrs = getLanAddresses();
  const ipUrls = addrs.map((a) => `http://${a.address}:${port}`);
  const mdnsUrl = `http://${MDNS_HOST}:${port}`;
  const primaryUrl = mdnsOk ? mdnsUrl : (ipUrls[0] ?? `http://localhost:${port}`);
  // QR ведёт на IP: телефоны на Android не всегда понимают имена .local
  const qrUrl = ipUrls[0] ?? mdnsUrl;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    margin: 1,
    width: 420,
    errorCorrectionLevel: 'M',
    color: { dark: '#1A0B3B', light: '#FFFFFF' },
  });
  return { port, mdnsOk, mdnsUrl, ipUrls, primaryUrl, qrUrl, qrDataUrl, shortcutPath };
}

export function printBanner(info: ServerInfo): void {
  const lines: string[] = [];
  lines.push('ВИКТОРИНА ЗАПУЩЕНА');
  lines.push('');
  lines.push('Экран преподавателя (на этом ноутбуке):');
  lines.push(`   http://localhost:${info.port}/teacher`);
  lines.push('');
  lines.push('Адрес для детей:');
  if (info.mdnsOk) lines.push(`   ${info.mdnsUrl}      ← основной`);
  else lines.push('   (mDNS недоступен — используйте IP-адрес ниже)');
  for (const u of info.ipUrls) lines.push(`   ${u}`);
  if (info.ipUrls.length === 0) lines.push('   ⚠ Нет подключения к сети! Подключите ноутбук к Wi-Fi или кабелю.');
  if (info.shortcutPath) {
    lines.push('');
    lines.push('Ярлык для рабочих столов классных ПК:');
    lines.push(`   ${info.shortcutPath}`);
  }
  const width = Math.max(...lines.map((l) => [...l].length)) + 4;
  const bar = '═'.repeat(width);
  console.log(`\n╔${bar}╗`);
  for (const l of lines) console.log(`║  ${l}${' '.repeat(width - 2 - [...l].length)}║`);
  console.log(`╚${bar}╝\n`);
}
