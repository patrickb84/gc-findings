import { fetchContent, readJson, writeJson, type Manifest } from '../src/files.ts';
import { parseManifest } from '../src/manifest.ts';
import { parseTalk } from '../src/parse-talk.ts';
import { selectPilot, type PilotCandidate } from '../src/pilot.ts';
import type { RawContent } from '../src/types.ts';

const CONFERENCE = '/general-conference/2026/10';
const REQUESTED_SPEAKERS = ['Ciro Schmeil'];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const hymnUri = process.argv.find((a) => a.startsWith('--hymn='))?.slice('--hymn='.length);
const prior = await readJson<Manifest | null>('data/manifest.json', null);

const manifestRaw = await fetchContent(CONFERENCE);
const entries = parseManifest(manifestRaw.content.body);

const candidates: PilotCandidate[] = [];
for (const e of entries) {
  const path = `data/raw/${e.slug}.json`;
  let raw = await readJson<RawContent | null>(path, null);
  if (!raw) {
    raw = await fetchContent(e.uri);
    await writeJson(path, raw);
    await sleep(300);
  }
  candidates.push({ slug: e.slug, speaker: e.speaker, role: parseTalk(raw).role, order: e.order });
}

let hymn = prior?.hymn ?? null;
if (hymnUri) {
  const raw = await fetchContent(hymnUri);
  const slug = `hymn-${hymnUri.split('/').pop()}`;
  await writeJson(`data/raw/${slug}.json`, raw);
  hymn = { slug, uri: hymnUri, title: parseTalk(raw).title };
}

const pilot = selectPilot(candidates, REQUESTED_SPEAKERS);
const manifest: Manifest = { conference: CONFERENCE, entries, pilot, hymn };
await writeJson('data/manifest.json', manifest);
console.log(`${entries.length} talks fetched. Pilot: ${pilot.join(', ')}${hymn ? ` + ${hymn.slug}` : ''}`);
