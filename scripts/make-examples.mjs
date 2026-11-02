// Рисует картинки для демо-теста (собственные SVG, CC0) и собирает zip-архив.
// Запуск: node scripts/make-examples.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { zipSync } from 'fflate';

const dir = path.resolve('примеры/Демо-тест');
const O = '#1A1033';

const saturn = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="700" viewBox="0 0 1000 700">
<rect width="1000" height="700" fill="#140B33"/>
${Array.from({ length: 60 }, (_, i) => `<circle cx="${(i * 197) % 1000}" cy="${(i * 331) % 700}" r="${1 + (i % 3)}" fill="#fff" opacity="${0.4 + (i % 5) / 10}"/>`).join('')}
<defs><clipPath id="front"><rect x="0" y="360" width="1000" height="400"/></clipPath></defs>
<g transform="rotate(-14 500 360)">
<ellipse cx="500" cy="360" rx="330" ry="80" fill="none" stroke="${O}" stroke-width="44"/>
<ellipse cx="500" cy="360" rx="330" ry="80" fill="none" stroke="#E9C98B" stroke-width="30"/>
</g>
<circle cx="500" cy="360" r="170" fill="#F0B95A" stroke="${O}" stroke-width="8"/>
<path d="M345 305 Q500 285 655 305" stroke="#D9963B" stroke-width="22" fill="none" stroke-linecap="round"/>
<path d="M332 375 Q500 355 668 375" stroke="#D9963B" stroke-width="18" fill="none" stroke-linecap="round"/>
<path d="M360 440 Q500 425 640 440" stroke="#D9963B" stroke-width="14" fill="none" stroke-linecap="round"/>
<g transform="rotate(-14 500 360)" clip-path="url(#front)">
<ellipse cx="500" cy="360" rx="330" ry="80" fill="none" stroke="${O}" stroke-width="44"/>
<ellipse cx="500" cy="360" rx="330" ry="80" fill="none" stroke="#E9C98B" stroke-width="30"/>
</g>
</svg>`;

const hexagon = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="700" viewBox="0 0 900 700">
<rect width="900" height="700" fill="#FFF7E6"/>
<polygon points="450,90 690,225 690,475 450,610 210,475 210,225" fill="#7FC8F8" stroke="${O}" stroke-width="14" stroke-linejoin="round"/>
${[[450,90],[690,225],[690,475],[450,610],[210,475],[210,225]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="16" fill="#FF6B6B" stroke="${O}" stroke-width="6"/>`).join('')}
</svg>`;

const maple = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="800" viewBox="0 0 900 800">
<rect width="900" height="800" fill="#EAF7E1"/>
<path d="M450 90 L505 240 L600 190 L585 300 L730 260 L690 360 L790 420 L640 470 L670 560 L520 520 L470 640 L430 640 L380 520 L230 560 L260 470 L110 420 L210 360 L170 260 L315 300 L300 190 L395 240 Z"
 fill="#E8572A" stroke="${O}" stroke-width="12" stroke-linejoin="round"/>
<path d="M450 640 L450 760" stroke="${O}" stroke-width="16" stroke-linecap="round"/>
<path d="M450 620 L450 230 M450 470 L300 330 M450 470 L600 330 M450 540 L280 480 M450 540 L620 480" stroke="#A8361A" stroke-width="8" fill="none" stroke-linecap="round"/>
</svg>`;

const files = {
  '1.png': saturn,
  'шестиугольник.png': hexagon,
  'лист-клёна.png': maple,
};
for (const [name, svg] of Object.entries(files)) {
  await sharp(Buffer.from(svg)).png().toFile(path.join(dir, name));
}
const zip = {};
for (const f of fs.readdirSync(dir)) zip[`Демо-тест/${f}`] = new Uint8Array(fs.readFileSync(path.join(dir, f)));
fs.writeFileSync(path.resolve('примеры/Демо-тест.zip'), zipSync(zip, { level: 6 }));
console.log('Готово:', Object.keys(zip).join(', '));
