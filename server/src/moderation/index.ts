import { NAME_MAX } from '@viktorina/shared';
import { ROOTS, WORDS } from './stoplist';

const LATIN_TO_CYR: Record<string, string> = {
  a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м', o: 'о', p: 'р', t: 'т', x: 'х', y: 'у',
  '0': 'о', '3': 'з', '4': 'ч', '6': 'б', '@': 'а', '$': 'с', '1': 'і',
};

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKC').replace(/ё/g, 'е');
}

function toCyrillic(s: string): string {
  return [...s].map((ch) => LATIN_TO_CYR[ch] ?? ch).join('');
}

const TRANSLIT: [string, string][] = [
  ['shch', 'щ'], ['sch', 'щ'], ['zh', 'ж'], ['kh', 'х'], ['ch', 'ч'], ['sh', 'ш'], ['ya', 'я'], ['yu', 'ю'], ['yo', 'е'],
  ['a', 'а'], ['b', 'б'], ['v', 'в'], ['g', 'г'], ['d', 'д'], ['e', 'е'], ['z', 'з'], ['i', 'и'], ['j', 'й'], ['y', 'й'],
  ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'],
  ['f', 'ф'], ['h', 'х'], ['c', 'к'], ['x', 'кс'], ['w', 'в'], ['q', 'к'],
];

/** Грубая транслитерация «pizda» → «пизда», «huy» → «хуй» */
function translit(s: string): string {
  let out = '';
  let i = 0;
  outer: while (i < s.length) {
    for (const [lat, cyr] of TRANSLIT) {
      if (s.startsWith(lat, i)) {
        out += cyr;
        i += lat.length;
        continue outer;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

function lettersOnly(s: string): string {
  return s.replace(/[^a-zа-я]/g, '');
}

const roots = ROOTS.map(normalize);
const words = new Set(WORDS.map(normalize));

/** Есть ли в имени запрещённые слова */
export function isProfane(name: string): boolean {
  const base = normalize(name);
  const variants = new Set([base, toCyrillic(base), translit(base)]);
  for (const v of variants) {
    const squashed = lettersOnly(v);
    // повторяющиеся буквы «хуууй» → «хуй»
    const deduped = squashed.replace(/(.)\1+/g, '$1');
    for (const r of roots) {
      if (squashed.includes(r) || deduped.includes(r)) return true;
    }
    for (const w of v.split(/[^a-zа-я]+/)) {
      if (w && words.has(w)) return true;
    }
    if (words.has(squashed)) return true;
  }
  return false;
}

export interface NameCheck {
  ok: boolean;
  name: string;
  error?: string;
}

export function checkName(raw: string): NameCheck {
  const name = String(raw ?? '')
    .replace(/[\u0000-\u001F\u007F​-‏‪-‮]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name) return { ok: false, name, error: 'Напиши своё имя' };
  if ([...name].length > NAME_MAX) return { ok: false, name, error: `Имя слишком длинное — не больше ${NAME_MAX} символов` };
  if (!/[\p{L}\p{N}]/u.test(name)) return { ok: false, name, error: 'В имени должны быть буквы' };
  if (isProfane(name)) return { ok: false, name, error: 'Такое имя не подойдёт. Придумай другое' };
  return { ok: true, name };
}
