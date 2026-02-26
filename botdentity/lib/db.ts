import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { SCHEMA_SQL } from './schema';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'botdentity.db'));

db.exec(SCHEMA_SQL);

export default db;
