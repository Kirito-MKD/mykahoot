/**
 * Находит позицию первой синтаксической ошибки в JSON.
 * Нужен потому, что браузеры по-разному (а Chrome — вообще без позиции) сообщают об ошибке.
 */
export interface JsonErrorLocation {
  pos: number;
  reason: 'trailingComma' | 'missingComma' | 'unclosedString' | 'unexpectedEnd' | 'unexpected' | 'singleQuote';
}

export function locateJsonError(text: string): JsonErrorLocation | null {
  let i = 0;
  const n = text.length;
  const ws = () => {
    while (i < n && /\s/.test(text[i]!)) i++;
  };
  class Fail extends Error {
    constructor(readonly loc: JsonErrorLocation) {
      super('json');
    }
  }
  const fail = (reason: JsonErrorLocation['reason'], pos = i): never => {
    throw new Fail({ pos: Math.min(pos, n), reason });
  };

  const string = () => {
    const start = i;
    i++; // "
    while (i < n) {
      const ch = text[i]!;
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '"') {
        i++;
        return;
      }
      if (ch === '\n') fail('unclosedString', start);
      i++;
    }
    fail('unclosedString', start);
  };

  const value = (): void => {
    ws();
    if (i >= n) fail('unexpectedEnd');
    const ch = text[i]!;
    if (ch === '{') return object();
    if (ch === '[') return array();
    if (ch === '"') return string();
    if (ch === "'") fail('singleQuote');
    const m = text.slice(i).match(/^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/);
    if (!m) fail('unexpected');
    i += m![0].length;
  };

  const object = () => {
    i++;
    ws();
    if (text[i] === '}') {
      i++;
      return;
    }
    for (;;) {
      ws();
      if (i >= n) fail('unexpectedEnd');
      if (text[i] === '}') fail('trailingComma');
      if (text[i] === "'") fail('singleQuote');
      if (text[i] !== '"') fail('unexpected');
      string();
      ws();
      if (text[i] !== ':') fail(i >= n ? 'unexpectedEnd' : 'unexpected');
      i++;
      value();
      ws();
      if (i >= n) fail('unexpectedEnd');
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === '}') {
        i++;
        return;
      }
      fail('missingComma');
    }
  };

  const array = () => {
    i++;
    ws();
    if (text[i] === ']') {
      i++;
      return;
    }
    for (;;) {
      ws();
      if (text[i] === ']') fail('trailingComma');
      value();
      ws();
      if (i >= n) fail('unexpectedEnd');
      if (text[i] === ',') {
        i++;
        continue;
      }
      if (text[i] === ']') {
        i++;
        return;
      }
      fail('missingComma');
    }
  };

  try {
    value();
    ws();
    if (i < n) fail('unexpected');
    return null;
  } catch (e) {
    if (e instanceof Fail) return e.loc;
    throw e;
  }
}
