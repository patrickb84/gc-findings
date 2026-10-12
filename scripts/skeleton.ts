import { countPronouns, countTerms, rankTerms } from '../src/count.ts';
import { loadRaw, readJson, writeJson, type Manifest } from '../src/files.ts';
import { parseTalk } from '../src/parse-talk.ts';
import { exactFindings, mergeIndex, mergeSkeleton } from '../src/skeleton.ts';
import type { IndexEntry, TalkFile, TermCounts } from '../src/types.ts';

const manifest = await readJson<Manifest | null>('data/manifest.json', null);
if (!manifest) throw new Error('data/manifest.json missing - run pnpm fetch-talks first');

const site = 'https://www.churchofjesuschrist.org/study';
const countsByTalk: Record<string, TermCounts> = {};
const paragraphsByTalk: Record<string, string[]> = {};
const lastOrder = Math.max(...manifest.entries.map((e) => e.order));
const lastSession = manifest.entries.at(-1)?.session ?? '';

const items = [
  ...manifest.pilot.map((slug) => ({ slug, kind: 'talk' as const })),
  ...(manifest.hymn ? [{ slug: manifest.hymn.slug, kind: 'hymn' as const }] : []),
];

for (const { slug, kind } of items) {
  const parsed = parseTalk(await loadRaw(slug));
  const entry = manifest.entries.find((e) => e.slug === slug);
  const counts = countTerms(parsed.paragraphs);
  countsByTalk[slug] = counts;
  paragraphsByTalk[slug] = parsed.paragraphs;
  await writeJson(`data/counts/${slug}.json`, counts);

  const base = {
    id: slug,
    kind,
    speaker: kind === 'hymn' ? '' : (entry?.speaker ?? parsed.speaker),
    role: parsed.role,
    title: entry?.title ?? parsed.title,
    session: entry?.session ?? lastSession,
    order: entry?.order ?? lastOrder + 1,
    url: `${site}${entry?.uri ?? manifest.hymn?.uri ?? ''}?lang=eng`,
    pronouns: countPronouns(parsed.paragraphs),
  };
  const existing = await readJson<TalkFile | null>(`data/talks/${slug}.json`, null);
  await writeJson(`data/talks/${slug}.json`, mergeSkeleton(existing, base, exactFindings(parsed)));
}

const existingIndex = await readJson<IndexEntry[]>('data/index.json', []);
await writeJson('data/index.json', mergeIndex(existingIndex, rankTerms(countsByTalk), paragraphsByTalk));
console.log(`Skeletons written for ${items.length} items; index rebuilt.`);
