import { readdir } from 'node:fs/promises';
import { loadRaw, readJson, writeJson } from '../src/files.ts';
import { corpusOf, parseTalk } from '../src/parse-talk.ts';
import { checkDiscoveries, checkTalk, type Rejection } from '../src/quotes.ts';
import type { Discovery, TalkFile } from '../src/types.ts';

const files = (await readdir('data/talks')).filter((f) => f.endsWith('.json'));
const talks: Record<string, TalkFile> = {};
const rejectedNow: Rejection[] = [];
const errors: string[] = [];

for (const file of files) {
  const talk = await readJson<TalkFile | null>(`data/talks/${file}`, null);
  if (!talk) continue;
  const result = checkTalk(talk, corpusOf(parseTalk(await loadRaw(talk.id))));
  talk.findings = result.kept;
  talks[talk.id] = talk;
  rejectedNow.push(...result.rejected);
  errors.push(...result.errors);
  await writeJson(`data/talks/${file}`, talk);
}

const discoveries = await readJson<Discovery[]>('data/discoveries.json', []);
errors.push(...checkDiscoveries(discoveries, talks));

const rejectedBefore = await readJson<Rejection[]>('data/rejected.json', []);
await writeJson('data/rejected.json', [...rejectedBefore, ...rejectedNow]);

const total = Object.values(talks).reduce((n, t) => n + t.findings.length, 0);
console.log(`${total} findings kept, ${rejectedNow.length} rejected this run.`);
for (const r of rejectedNow) console.log(`  rejected ${r.talk}/${r.finding}: ${r.reason}`);
for (const e of errors) console.error(`  error ${e}`);
process.exit(errors.length ? 1 : 0);
