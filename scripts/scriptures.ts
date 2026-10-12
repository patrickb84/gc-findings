import { readdir } from 'node:fs/promises';
import { readJson, writeJson } from '../src/files.ts';
import { buildScriptureTable } from '../src/scriptures.ts';
import type { TalkFile } from '../src/types.ts';

const files = (await readdir('data/talks')).filter((f) => f.endsWith('.json'));
const talks = await Promise.all(files.map((f) => readJson<TalkFile | null>(`data/talks/${f}`, null)));
const rows = buildScriptureTable(talks.filter((t): t is TalkFile => t !== null));
await writeJson('data/scriptures.json', rows);

const shared = rows.filter((r) => r.overlaps.length > 0);
const unknown = rows.filter((r) => r.volume === null);
console.log(`${rows.length} references written to data/scriptures.json; ${shared.length} share a verse with another.`);
for (const r of shared) console.log(`  ${r.ref} (${r.talks.join(', ')}) ~ ${r.overlaps.join('; ')}`);
if (unknown.length) console.log(`No volume for: ${unknown.map((r) => r.ref).join('; ')}`);
