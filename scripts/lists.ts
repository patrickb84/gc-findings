// node scripts/lists.ts check <lists.json>   checks a lists file (whole or partial) against the talks
// node scripts/lists.ts pages <out.json>     writes one Notion sub-page per talk ({slug, title, content}) from data/lists.json
// node scripts/lists.ts index <out.md>        writes the Lists page body, linking the sub-pages recorded in notion-map as list:<slug>
import { readdir, writeFile } from 'node:fs/promises';
import { loadRaw, readJson } from '../src/files.ts';
import { checkLists, listPageTitle, renderTalkLists, type ListsFile } from '../src/lists.ts';
import { corpusOf, parseTalk } from '../src/parse-talk.ts';
import type { TalkFile } from '../src/types.ts';

const [mode, path] = process.argv.slice(2);
if (!['check', 'pages', 'index'].includes(mode) || !path) throw new Error('usage: node scripts/lists.ts check <lists.json> | pages <out.json> | index <out.md>');

const talks: Record<string, TalkFile> = {};
for (const f of (await readdir('data/talks')).filter((x) => x.endsWith('.json'))) {
  const t = await readJson<TalkFile | null>(`data/talks/${f}`, null);
  if (t) talks[t.id] = t;
}

if (mode === 'check') {
  const file = await readJson<ListsFile>(path, {});
  const corpora: Record<string, string> = {};
  for (const slug of Object.keys(file)) if (talks[slug]) corpora[slug] = corpusOf(parseTalk(await loadRaw(slug)));
  const errors = checkLists(file, talks, corpora);
  const lists = Object.values(file).flatMap((t) => t.lists);
  console.log(`${Object.keys(file).length} talks, ${lists.filter((l) => !l.skip).length} lists, ${lists.filter((l) => l.skip).length} skipped, ${lists.reduce((n, l) => n + l.items.length, 0)} items`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(errors.length ? 1 : 0);
}

const file = await readJson<ListsFile>('data/lists.json', {});
const rows = (await readJson<{ rows: Record<string, string> }>('data/notion-map.json', { rows: {} })).rows;
const ordered = Object.keys(file).map((slug) => talks[slug]).sort((a, b) => a.order - b.order);
const shown = Object.values(file).flatMap((t) => t.lists).filter((l) => !l.skip);
const row = (key: string) => {
  const id = rows[key];
  if (!id) throw new Error(`no Notion page for ${key}`);
  return `https://app.notion.com/p/${id}`;
};

if (mode === 'pages') {
  const pages = ordered.map((talk) => ({ slug: talk.id, title: listPageTitle(talk), content: renderTalkLists(talk, file[talk.id], row(`talk:${talk.id}`)) }));
  await writeFile(path, JSON.stringify(pages, null, 2));
  console.log(`${pages.length} list pages written to ${path}`);
  process.exit(0);
}

const out = [
  '<callout icon="📋" color="gray_bg">',
  `\tEvery list the speakers gave: ${shown.length} lists from ${ordered.length} talks, in conference order, one page per talk. The principle, the short title and the line under each item are Claude's words; every quote is the speaker's own, checked against the talk text. Source: data/lists.json in the gc-findings repo.`,
  '</callout>',
];
let session = '';
for (const talk of ordered) {
  if (talk.session !== session) { session = talk.session; out.push(`## ${session}`); }
  out.push(`<page url="${row(`list:${talk.id}`)}">${listPageTitle(talk)}</page>`);
}
await writeFile(path, out.join('\n'));
console.log(`${ordered.length} talks, ${shown.length} lists indexed in ${path}`);
