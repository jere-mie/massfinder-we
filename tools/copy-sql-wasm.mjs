import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const destination = path.join(root, 'public', 'sql-wasm.wasm');

fs.copyFileSync(source, destination);
console.log(`Copied sql-wasm.wasm to ${path.relative(root, destination)}`);
