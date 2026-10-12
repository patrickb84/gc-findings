import { readdir } from 'node:fs/promises';
import { readJson, writeJson } from '../src/files.ts';
import { buildScriptureTable, groupPassages } from '../src/scriptures.ts';
import type { TalkFile } from '../src/types.ts';

const files = (await readdir('data/talks')).filter((f) => f.endsWith('.json'));
const talks = await Promise.all(files.map((f) => readJson<TalkFile | null>(`data/talks/${f}`, null)));
const rows = buildScriptureTable(talks.filter((t): t is TalkFile => t !== null));
await writeJson('data/scriptures.json', rows);
const passages = groupPassages(rows);
await writeJson('data/passages.json', passages);

const shared = passages.filter((p) => p.talks.length > 1);
const unknown = rows.filter((r) => r.volume === null);
console.log(`${rows.length} references written to data/scriptures.json.`);
console.log(`${passages.length} passages written to data/passages.json; ${shared.length} are cited by more than one talk.`);
for (const p of shared) console.log(`  ${p.label}: ${p.citations.length} citations in ${p.talks.join(', ')} (${p.refs.join('; ')})`);
if (unknown.length) console.log(`No volume for: ${unknown.map((r) => r.ref).join('; ')}`);
