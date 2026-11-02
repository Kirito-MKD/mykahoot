import { unzipSync } from 'fflate';
import { baseName, isImageName, naturalCompare } from '@viktorina/shared';

export interface PoolImage {
  /** Уникальный ключ в пуле (имя файла, при совпадении — с номером) */
  key: string;
  name: string;
  blob: Blob;
  url: string;
}

export interface ImportBatch {
  jsonTexts: { name: string; text: string }[];
  images: PoolImage[];
  warnings: string[];
}

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

function ext(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function isJunk(path: string): boolean {
  const b = baseName(path);
  return path.includes('__MACOSX') || b.startsWith('.') || b === 'Thumbs.db' || b === 'desktop.ini';
}

/** Читает файлы из перетаскивания, включая целые папки */
export async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = [...dt.items].filter((i) => i.kind === 'file');
  const entries = items.map((i) => (typeof i.webkitGetAsEntry === 'function' ? i.webkitGetAsEntry() : null));
  if (entries.some((e) => e?.isDirectory)) {
    const out: File[] = [];
    const walk = async (entry: FileSystemEntry, prefix: string): Promise<void> => {
      if (entry.isFile) {
        const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
        Object.defineProperty(file, 'relPath', { value: prefix + file.name });
        out.push(file);
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        // readEntries отдаёт файлы порциями — читаем, пока не вернёт пусто
        for (;;) {
          const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
          if (!batch.length) break;
          for (const e of batch) await walk(e, prefix + entry.name + '/');
        }
      }
    };
    for (const e of entries) if (e) await walk(e, '');
    return out;
  }
  return [...dt.files];
}

let keySeq = 0;

/** Разбирает пачку файлов: JSON, картинки, zip-архивы (распаковываются сами) */
export async function readBatch(files: File[]): Promise<ImportBatch> {
  const batch: ImportBatch = { jsonTexts: [], images: [], warnings: [] };
  const addImage = (name: string, blob: Blob) => {
    batch.images.push({ key: `${name}#${++keySeq}`, name, blob, url: URL.createObjectURL(blob) });
  };
  for (const f of files) {
    const path = (f as File & { relPath?: string }).relPath ?? f.webkitRelativePath ?? f.name;
    if (isJunk(path)) continue;
    const e = ext(f.name);
    if (e === 'json' || e === 'txt') {
      batch.jsonTexts.push({ name: f.name, text: await f.text() });
    } else if (isImageName(f.name)) {
      addImage(f.name, f);
    } else if (e === 'zip') {
      try {
        const data = unzipSync(new Uint8Array(await f.arrayBuffer()));
        for (const [p, bytes] of Object.entries(data)) {
          if (p.endsWith('/') || isJunk(p) || bytes.length === 0) continue;
          const name = baseName(p);
          const pe = ext(name);
          if (pe === 'json') batch.jsonTexts.push({ name, text: new TextDecoder('utf-8').decode(bytes) });
          else if (isImageName(name)) addImage(name, new Blob([bytes], { type: MIME[pe] ?? 'application/octet-stream' }));
        }
      } catch {
        batch.warnings.push(`Архив «${f.name}» не удалось распаковать — возможно, он повреждён или защищён паролем.`);
      }
    } else {
      batch.warnings.push(`Файл «${f.name}» пропущен: нужны .json, картинки (.png, .jpg, .webp, .gif) или .zip.`);
    }
  }
  batch.images.sort((a, b) => naturalCompare(a.name, b.name));
  return batch;
}
