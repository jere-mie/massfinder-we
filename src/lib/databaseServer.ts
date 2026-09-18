import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';
import { queryAll } from './databaseQueries';

export async function loadAllDataForBuild() {
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
  });
  const databasePath = path.join(process.cwd(), 'public', 'massfinder.db');
  const database = new SQL.Database(new Uint8Array(fs.readFileSync(databasePath)));
  try {
    return queryAll(database);
  } finally {
    database.close();
  }
}
