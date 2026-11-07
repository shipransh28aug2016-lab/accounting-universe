// After `vite build`: list every built file in dist/ and stamp it into dist/sw.js so the app works offline after one visit.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
const dist = new URL('../dist', import.meta.url).pathname;
const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dist).map(p => relative(dist, p)).filter(f => f !== 'sw.js');
const hash = createHash('sha256'); for (const f of files.sort()) hash.update(f).update(readFileSync(join(dist, f)));
const sw = join(dist, 'sw.js');
writeFileSync(sw, readFileSync(sw, 'utf8').replace('__BUILD__', hash.digest('hex').slice(0, 12)).replace('/*__FILES__*/', files.map(f => JSON.stringify('./' + f)).concat('"./"').join(',')));
console.log(`precache: ${files.length} files`);
