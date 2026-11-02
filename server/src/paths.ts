import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..', '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const DB_PATH = path.join(DATA_DIR, 'app.db');
export const CLIENT_DIST = path.join(ROOT_DIR, 'client', 'dist');
export const SHORTCUTS_DIR = path.join(ROOT_DIR, 'ярлыки');
