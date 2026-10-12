# GC Findings Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the six pilot items of October 2026 General Conference into verified, structured findings, a discovery page, and a browsable Notion workspace.

**Architecture:** A small Node + TypeScript toolkit does everything exact: fetch talks from the Church content API, parse text, scripture citations and footnotes, count words and phrases, build talk skeletons and a discovered-term index, and check every quote against the talk text. Claude then fills the interpreted findings (READ), connects and discovers across talks (CONNECT, DISCOVER), and publishes JSON to Notion through the Notion connector (PUBLISH). JSON in `data/` is the source of truth; Notion is a view.

**Tech Stack:** Node 24 (runs `.ts` directly via type stripping), TypeScript 5.9 (type check only), pnpm, cheerio (HTML parsing), vitest (tests), Notion MCP connector.

**Spec:** `docs/superpowers/specs/2026-10-12-gc-findings-pilot-design.md`

## Global Constraints

- Content API: `https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=<uri>`; conference uri `/general-conference/2026/10`. Response shape: `{ content: { body: string (HTML), footnotes: Record<string, { marker, text (HTML), referenceUris: { type, href, text }[] }> } }`.
- Full talk text stays local: `data/raw/` is gitignored and never published. Notion gets summaries, findings and short quotes with links.
- Every finding has a `quote` that appears verbatim in the talk (paragraphs + footnote text). Failures are dropped and listed in `data/rejected.json`.
- `revelation` findings are always `basis: "interpreted"` and their `note` starts with "Reads as".
- Finding ids: `x-...` are written by code and owned by code; `c-...` are written by Claude. Re-running code never deletes `c-` findings, and keeps Claude's `type`, `note`, `detail`, `terms` on `x-` findings.
- Talk id = the Church site slug (e.g. `48schmeil`), which already encodes session, order and speaker; talk files are `data/talks/<slug>.json`.
- `spoken: true` on a scripture means it is cited in the talk's body text; `false` means footnote only. (The API cannot tell what was read aloud; body citation is the exact, checkable stand-in.)
- Pilot rule: every talk by the Church President; the first talk; the last talk, plus the second-to-last if the last is the President's; Elder Ciro Schmeil's talk; the closing hymn. Business items ("Sustaining of ...", "Church Auditing Department Report") are not talks.
- Commit on branch `pilot/build`, never on `main`. Commit messages are plain, with no AI attribution trailer.
- Session paths: run git as `git -C C:/Dev/gc-findings ...` with a Windows-style path when the session is not started inside the repo.

## Review Focus

1. Curly quotes, curly apostrophes, em dashes and non-breaking spaces in talk text against a straight-typed quote: should still match. Pinned in Task 5.
2. Quotes with an ellipsis or a bracketed edit ("time for [us] to prepare"): should match the surrounding words in order. Pinned in Task 5.
3. Accented speaker names (Caussé, Muñoz Spannaus) in requested speakers; and a requested speaker who is not in the conference: should match without accents, and fail loudly when absent. Pinned in Task 2.
4. A footnote `scripture-ref` that points at the Guide to the Scriptures or a handbook, not scripture: must not be counted as a scripture. Pinned in Task 3.
5. Re-running the skeleton after Claude's READ: must not wipe Claude's findings or retyping. Pinned in Task 6.

---

### Task 1: Scaffold, shared types, manifest parser

**Files:**
- Create: `package.json`, `tsconfig.json`, `src/types.ts`, `src/manifest.ts`
- Test: `tests/manifest.test.ts`

**Interfaces:**
- Produces: all types in `src/types.ts`; `parseManifest(bodyHtml: string): ManifestEntry[]`

- [ ] **Step 1: Branch and scaffold**

```bash
git -C C:/Dev/gc-findings switch -c pilot/build
cd C:/Dev/gc-findings
pnpm init
pnpm add cheerio@1.1.2
pnpm add -D vitest@3.2.4 typescript@5.9.2 @types/node@24
```

Replace `package.json` with:

```json
{
  "name": "gc-findings",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc",
    "fetch": "node scripts/fetch.ts",
    "skeleton": "node scripts/skeleton.ts",
    "check": "node scripts/check-quotes.ts"
  }
}
```

then re-run `pnpm add cheerio@1.1.2` and `pnpm add -D vitest@3.2.4 typescript@5.9.2 @types/node@24` so the dependency blocks are written back. If an exact version does not resolve, use the newest patch of the same minor and note it in the commit message.

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "scripts", "tests"]
}
```

- [ ] **Step 2: Write `src/types.ts`**

```ts
export const FINDING_TYPES = [
  'invitation', 'promise', 'list',
  'testimony', 'revelation',
  'scripture', 'prophet', 'past_prophet', 'christ', 'source',
  'story', 'relationship',
  'image', 'place', 'name_of_christ',
] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const ARC_BEATS = ['story', 'principle', 'scripture', 'quote', 'list', 'invitation', 'promise', 'testimony'] as const;
export type ArcBeat = (typeof ARC_BEATS)[number];

export interface Finding {
  id: string;
  type: FindingType;
  quote: string;
  basis: 'exact' | 'interpreted';
  note?: string;
  ref?: string;
  spoken?: boolean;
  paired_with?: string;
  detail?: Record<string, string | string[]>;
  terms?: string[];
}

export interface ManifestEntry {
  slug: string;
  uri: string;
  speaker: string;
  title: string;
  session: string;
  order: number;
}

export interface Citation { ref: string; href: string; inText: boolean }
export interface NoteRef { type: string; text: string; href: string }
export interface Note { marker: string; text: string; refs: NoteRef[] }

export interface ParsedTalk {
  speaker: string;
  role: string;
  title: string;
  paragraphs: string[];
  citations: Citation[];
  notes: Note[];
}

export interface TalkFile {
  id: string;
  kind: 'talk' | 'hymn';
  speaker: string;
  role: string;
  title: string;
  session: string;
  order: number;
  url: string;
  summary: string;
  audience: { who: string; quote?: string } | null;
  arc: ArcBeat[];
  orientation: { past: number; present: number; future: number } | null;
  pronouns: { i: number; we: number; you: number };
  findings: Finding[];
}

export type TermCounts = Record<string, number>;

export interface IndexEntry {
  term: string;
  kind: 'keyword' | 'subject' | 'image';
  variants: string[];
  mentions: number | null;
  talks: string[];
  status: 'discovered' | 'proposed_family' | 'approved' | 'rejected';
}

export interface Discovery {
  title: string;
  body: string;
  evidence: { talk: string; finding: string }[];
}

export interface RawFootnote {
  marker: string;
  text: string;
  referenceUris?: { type: string; href: string; text: string }[];
}
export interface RawContent { content: { body: string; footnotes?: Record<string, RawFootnote> } }
```

- [ ] **Step 3: Write the failing test `tests/manifest.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { parseManifest } from '../src/manifest.ts';

const tile = (slug: string, speaker: string, title: string) =>
  `<li><a href="/study/general-conference/2026/10/${slug}?lang=eng" class="list-tile"><p class="primaryMeta">${speaker}</p><p class="title">${title}</p><p class="description">d</p></a></li>`;
const session = (slug: string, title: string) =>
  `<li><a href="/study/general-conference/2026/10/${slug}?lang=eng" class="list-tile"><p class="title">${title}</p></a></li>`;

const html = `<nav class="manifest"><ul>
  ${session('saturday-morning-session', 'Saturday Morning Session')}
  ${tile('11christofferson', 'D. Todd Christofferson', 'Sustaining of General Authorities, Area Seventies, and General Officers')}
  ${tile('12gong', 'Gerrit W. Gong', 'Come to the Lord in His Holy House')}
  ${session('sunday-afternoon-session', 'Sunday Afternoon Session')}
  ${tile('510oaks', 'Dallin H. Oaks', 'Closing Remarks')}
</ul></nav>`;

describe('parseManifest', () => {
  it('lists talks in order with their session, skipping business items', () => {
    expect(parseManifest(html)).toEqual([
      { slug: '12gong', uri: '/general-conference/2026/10/12gong', speaker: 'Gerrit W. Gong', title: 'Come to the Lord in His Holy House', session: 'Saturday Morning Session', order: 1 },
      { slug: '510oaks', uri: '/general-conference/2026/10/510oaks', speaker: 'Dallin H. Oaks', title: 'Closing Remarks', session: 'Sunday Afternoon Session', order: 2 },
    ]);
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `pnpm test tests/manifest.test.ts`
Expected: FAIL, cannot find `../src/manifest.ts`.

- [ ] **Step 5: Write `src/manifest.ts`**

```ts
import * as cheerio from 'cheerio';
import type { ManifestEntry } from './types.ts';

const NOT_TALKS = /^(Sustaining of|Church Auditing Department Report)/;

export function parseManifest(bodyHtml: string): ManifestEntry[] {
  const $ = cheerio.load(bodyHtml);
  const out: ManifestEntry[] = [];
  let session = '';
  $('a.list-tile').each((_, a) => {
    const uri = ($(a).attr('href') ?? '').replace(/^\/study/, '').replace(/\?.*$/, '');
    const slug = uri.split('/').pop() ?? '';
    const title = $(a).find('p.title').first().text().trim();
    if (slug.endsWith('-session')) {
      session = title;
      return;
    }
    if (NOT_TALKS.test(title)) return;
    const speaker = $(a).find('p.primaryMeta').first().text().trim();
    out.push({ slug, uri, speaker, title, session, order: out.length + 1 });
  });
  return out;
}
```

- [ ] **Step 6: Run tests and type check**

Run: `pnpm test && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git -C C:/Dev/gc-findings add package.json pnpm-lock.yaml tsconfig.json src tests
git -C C:/Dev/gc-findings commit -m "Scaffold toolkit, shared types and manifest parser"
```

---

### Task 2: Pilot selection

**Files:**
- Create: `src/pilot.ts`
- Test: `tests/pilot.test.ts`

**Interfaces:**
- Produces: `PROPHET_ROLE: string`; `fold(s: string): string`; `interface PilotCandidate { slug: string; speaker: string; role: string; order: number }`; `selectPilot(talks: PilotCandidate[], requestedSpeakers: string[]): string[]` (slugs in conference order)

- [ ] **Step 1: Write the failing test `tests/pilot.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { PROPHET_ROLE, selectPilot } from '../src/pilot.ts';

const t = (slug: string, speaker: string, order: number, role = 'Of the Quorum of the Twelve Apostles') => ({ slug, speaker, role, order });

describe('selectPilot', () => {
  it('takes first, last, every prophet talk and requested speakers', () => {
    const talks = [
      t('12gong', 'Gerrit W. Gong', 1),
      t('13runia', 'Tamara W. Runia', 2),
      t('48schmeil', 'Ciro Schmeil', 3),
      t('49oaks', 'Dallin H. Oaks', 4, PROPHET_ROLE),
      t('58reid', 'Gabriel W. Reid', 5),
      t('59gilbert', 'Clark G. Gilbert', 6),
      t('510oaks', 'Dallin H. Oaks', 7, PROPHET_ROLE),
    ];
    expect(selectPilot(talks, ['Ciro Schmeil'])).toEqual(['12gong', '48schmeil', '49oaks', '59gilbert', '510oaks']);
  });

  it('does not add the second-to-last talk when the last is not the prophet', () => {
    const talks = [t('a', 'A', 1), t('b', 'B', 2), t('c', 'C', 3)];
    expect(selectPilot(talks, [])).toEqual(['a', 'c']);
  });

  it('matches requested speakers without accents or case', () => {
    const talks = [t('a', 'A', 1), t('52munoz-spannaus', 'Andrea Muñoz Spannaus', 2), t('c', 'C', 3)];
    expect(selectPilot(talks, ['andrea munoz'])).toEqual(['a', '52munoz-spannaus', 'c']);
  });

  it('fails loudly when a requested speaker gave no talk', () => {
    expect(() => selectPilot([t('a', 'A', 1)], ['Nobody Here'])).toThrow('No talk by "Nobody Here"');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test tests/pilot.test.ts`
Expected: FAIL, cannot find `../src/pilot.ts`.

- [ ] **Step 3: Write `src/pilot.ts`**

```ts
export const PROPHET_ROLE = 'President of The Church of Jesus Christ of Latter-day Saints';

export interface PilotCandidate { slug: string; speaker: string; role: string; order: number }

export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function selectPilot(talks: PilotCandidate[], requestedSpeakers: string[]): string[] {
  const sorted = [...talks].sort((a, b) => a.order - b.order);
  const isProphet = (x: PilotCandidate) => x.role === PROPHET_ROLE;
  const picked = new Set<string>();

  const first = sorted[0];
  const last = sorted.at(-1);
  if (first) picked.add(first.slug);
  if (last) {
    picked.add(last.slug);
    const secondToLast = sorted.at(-2);
    if (isProphet(last) && secondToLast) picked.add(secondToLast.slug);
  }
  for (const x of sorted) if (isProphet(x)) picked.add(x.slug);

  for (const name of requestedSpeakers) {
    const matches = sorted.filter((x) => fold(x.speaker).includes(fold(name)));
    if (matches.length === 0) throw new Error(`No talk by "${name}"`);
    for (const m of matches) picked.add(m.slug);
  }

  return sorted.filter((x) => picked.has(x.slug)).map((x) => x.slug);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C C:/Dev/gc-findings add src/pilot.ts tests/pilot.test.ts
git -C C:/Dev/gc-findings commit -m "Pilot selection rule"
```

---

### Task 3: Talk parser

**Files:**
- Create: `src/parse-talk.ts`
- Test: `tests/parse-talk.test.ts`

**Interfaces:**
- Consumes: `RawContent`, `ParsedTalk`, `Citation`, `Note` from `src/types.ts`
- Produces: `parseTalk(raw: RawContent): ParsedTalk`; `corpusOf(parsed: ParsedTalk): string` (paragraphs plus footnote text, newline-joined; the text quotes are checked against)

- [ ] **Step 1: Write the failing test `tests/parse-talk.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { corpusOf, parseTalk } from '../src/parse-talk.ts';
import type { RawContent } from '../src/types.ts';

const raw: RawContent = {
  content: {
    body: `<header><h1>Consider Your Ways</h1>
      <div class="byline"><p class="author-name">By Elder Ciro Schmeil</p><p class="author-role">Of the Seventy</p></div></header>
      <div class="body-block">
        <p>It is “the great plan of happiness” (<a class="scripture-ref" href="/study/scriptures/bofm/alma/42?lang=eng&amp;id=p8#p8">Alma 42:8</a>).</p>
        <p>God gave us “divine helps”<a class="note-ref" href="#note1"><sup class="marker" data-value="1"></sup></a> for mortality.</p>
        <ol class="decimal"><li><p>Pray daily.</p></li><li><p>Keep covenants.</p></li></ol>
      </div>`,
    footnotes: {
      note1: { marker: '1.', text: '<p>See Dallin H. Oaks, “Divine Helps for Mortality,” <i>Liahona</i>, May 2025.</p>', referenceUris: [{ type: 'cross-ref', href: '/study/general-conference/2025/04/oaks', text: 'Divine Helps for Mortality' }] },
      note2: { marker: '2.', text: '<p>See Guide to the Scriptures, “Humble.”</p>', referenceUris: [{ type: 'scripture-ref', href: '/study/scriptures/gs/humble?lang=eng', text: 'Humble' }] },
      note3: { marker: '3.', text: '<p>See <a>Alma 34:32</a>; <a>Alma 42:8</a>.</p>', referenceUris: [
        { type: 'scripture-ref', href: '/study/scriptures/bofm/alma/34?lang=eng&amp;id=p32#p32', text: 'Alma 34:32' },
        { type: 'scripture-ref', href: '/study/scriptures/bofm/alma/42?lang=eng&amp;id=p8#p8', text: 'Alma 42:8' },
      ] },
    },
  },
};

describe('parseTalk', () => {
  const p = parseTalk(raw);

  it('reads the byline without titles', () => {
    expect(p.speaker).toBe('Ciro Schmeil');
    expect(p.role).toBe('Of the Seventy');
    expect(p.title).toBe('Consider Your Ways');
  });

  it('keeps leaf paragraphs and list items, without note markers', () => {
    expect(p.paragraphs).toEqual([
      'It is “the great plan of happiness” (Alma 42:8).',
      'God gave us “divine helps” for mortality.',
      'Pray daily.',
      'Keep covenants.',
    ]);
  });

  it('marks body citations as in text and footnote-only ones as not, skipping non-scripture refs and repeats', () => {
    expect(p.citations.map((c) => [c.ref, c.inText])).toEqual([
      ['Alma 42:8', true],
      ['Alma 34:32', false],
    ]);
  });

  it('keeps footnotes as plain text with their references', () => {
    expect(p.notes[0]).toEqual({
      marker: '1.',
      text: 'See Dallin H. Oaks, “Divine Helps for Mortality,” Liahona, May 2025.',
      refs: [{ type: 'cross-ref', href: '/study/general-conference/2025/04/oaks', text: 'Divine Helps for Mortality' }],
    });
  });

  it('builds the quote corpus from paragraphs and footnotes', () => {
    expect(corpusOf(p)).toContain('Keep covenants.');
    expect(corpusOf(p)).toContain('Divine Helps for Mortality');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test tests/parse-talk.test.ts`
Expected: FAIL, cannot find `../src/parse-talk.ts`.

- [ ] **Step 3: Write `src/parse-talk.ts`**

```ts
import * as cheerio from 'cheerio';
import type { Citation, Note, ParsedTalk, RawContent } from './types.ts';

const SCRIPTURE_PATH = /^\/study\/scriptures\/(ot|nt|bofm|dc-testament|pgp)\//;
const TITLES = /^(President|Elder|Sister|Brother|Bishop)\s+/;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export function parseTalk(raw: RawContent): ParsedTalk {
  const $ = cheerio.load(raw.content.body);
  $('a.note-ref').remove();

  const speaker = clean($('p.author-name').first().text()).replace(/^By\s+/, '').replace(TITLES, '');
  const role = clean($('p.author-role').first().text());
  const title = clean($('h1').first().text());

  const paragraphs = $('div.body-block')
    .find('p, li')
    .toArray()
    .filter((el) => $(el).find('p, li').length === 0)
    .map((el) => clean($(el).text()))
    .filter(Boolean);

  const citations: Citation[] = [];
  const seen = new Set<string>();
  $('div.body-block a.scripture-ref').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (!SCRIPTURE_PATH.test(href)) return;
    const ref = clean($(a).text());
    citations.push({ ref, href, inText: true });
    seen.add(ref);
  });

  const notes: Note[] = Object.values(raw.content.footnotes ?? {}).map((f) => ({
    marker: f.marker,
    text: clean(cheerio.load(f.text).text()),
    refs: (f.referenceUris ?? []).map((r) => ({ type: r.type, href: r.href.replace(/&amp;/g, '&'), text: r.text })),
  }));

  for (const n of notes) {
    for (const r of n.refs) {
      if (r.type !== 'scripture-ref' || !SCRIPTURE_PATH.test(r.href) || seen.has(r.text)) continue;
      citations.push({ ref: r.text, href: r.href, inText: false });
      seen.add(r.text);
    }
  }

  return { speaker, role, title, paragraphs, citations, notes };
}

export function corpusOf(parsed: ParsedTalk): string {
  return [...parsed.paragraphs, ...parsed.notes.map((n) => n.text)].join('\n');
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C C:/Dev/gc-findings add src/parse-talk.ts tests/parse-talk.test.ts
git -C C:/Dev/gc-findings commit -m "Talk parser: text, scripture citations, footnotes"
```

---

### Task 4: Counting, discovery ranking, family counts

**Files:**
- Create: `src/stopwords.ts`, `src/count.ts`
- Test: `tests/count.test.ts`

**Interfaces:**
- Produces: `tokenize(text: string): string[]`; `countTerms(paragraphs: string[], maxN?: number): TermCounts`; `countPronouns(paragraphs: string[]): { i: number; we: number; you: number }`; `rankTerms(countsByTalk: Record<string, TermCounts>, minMentions?: number, limit?: number): IndexEntry[]`; `countFamily(variants: string[], paragraphsByTalk: Record<string, string[]>): { mentions: number; talks: string[] }`

- [ ] **Step 1: Write `src/stopwords.ts`**

```ts
export const STOPWORDS = new Set(`
a about above after again against all am an and any are as at be because been before being below between both but by
can could did do does doing down during each few for from further had has have having he her here hers herself him
himself his how i if in into is it its itself just let me more most my myself no nor not now of off on once only or
other our ours ourselves out over own same she should so some such than that the their theirs them themselves then
there these they this those through to too under until up very was we were what when where which while who whom why
will with would you your yours yourself yourselves also us may might must shall said say says one ones us upon
yet even every many much its i'm i've we're we've you're you've it's that's there's don't didn't can't won't
`.split(/\s+/).filter(Boolean));
```

- [ ] **Step 2: Write the failing test `tests/count.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { countFamily, countPronouns, countTerms, rankTerms, tokenize } from '../src/count.ts';

describe('tokenize', () => {
  it('lowercases, keeps accents and inner apostrophes, folds curly apostrophes', () => {
    expect(tokenize('The Savior’s peace, Caussé!')).toEqual(['the', "savior's", 'peace', 'caussé']);
  });
});

describe('countTerms', () => {
  it('counts words and phrases that do not start or end on a stopword, within a paragraph', () => {
    const c = countTerms(['The Prince of Peace brings peace.', 'Peace']);
    expect(c['peace']).toBe(3);
    expect(c['prince of peace']).toBe(1);
    expect(c['prince']).toBe(1);
    expect(c['the']).toBeUndefined();
    expect(c['of peace']).toBeUndefined();
    expect(c['brings peace']).toBe(1);
  });
});

describe('countPronouns', () => {
  it('groups I/me/my, we/us/our and you/your', () => {
    expect(countPronouns(['I invite you and your family; we will help us all.'])).toEqual({ i: 1, we: 2, you: 2 });
  });
});

describe('rankTerms', () => {
  it('ranks by talks touched, then mentions, dropping single mentions', () => {
    const ranked = rankTerms({
      a: { peace: 5, temple: 1, boat: 1 },
      b: { peace: 1, temple: 2 },
    });
    expect(ranked.map((r) => [r.term, r.talks.length, r.mentions])).toEqual([
      ['peace', 2, 6],
      ['temple', 2, 3],
    ]);
    expect(ranked[0]).toMatchObject({ kind: 'keyword', variants: ['peace'], status: 'discovered', talks: ['a', 'b'] });
  });
});

describe('countFamily', () => {
  it('counts each occurrence once, longest variant first', () => {
    const r = countFamily(['peace', 'prince of peace', 'peacemakers'], {
      a: ['The Prince of Peace brings peace.'],
      b: ['Blessed are the peacemakers.'],
      c: ['Nothing here.'],
    });
    expect(r).toEqual({ mentions: 3, talks: ['a', 'b'] });
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm test tests/count.test.ts`
Expected: FAIL, cannot find `../src/count.ts`.

- [ ] **Step 4: Write `src/count.ts`**

```ts
import { STOPWORDS } from './stopwords.ts';
import type { IndexEntry, TermCounts } from './types.ts';

export function tokenize(text: string): string[] {
  return (text.toLowerCase().replace(/[‘’]/g, "'").match(/[\p{L}']+/gu) ?? [])
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

export function countTerms(paragraphs: string[], maxN = 3): TermCounts {
  const counts: TermCounts = {};
  for (const p of paragraphs) {
    const toks = tokenize(p);
    for (let n = 1; n <= maxN; n++) {
      for (let i = 0; i + n <= toks.length; i++) {
        const gram = toks.slice(i, i + n);
        if (STOPWORDS.has(gram[0]!) || STOPWORDS.has(gram[n - 1]!)) continue;
        const key = gram.join(' ');
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
  }
  return counts;
}

const PRONOUNS = {
  i: ['i', 'me', 'my', 'mine', 'myself'],
  we: ['we', 'us', 'our', 'ours', 'ourselves'],
  you: ['you', 'your', 'yours', 'yourself', 'yourselves'],
} as const;

export function countPronouns(paragraphs: string[]): { i: number; we: number; you: number } {
  const c = { i: 0, we: 0, you: 0 };
  for (const tok of paragraphs.flatMap(tokenize)) {
    for (const k of ['i', 'we', 'you'] as const) {
      if ((PRONOUNS[k] as readonly string[]).includes(tok)) c[k]++;
    }
  }
  return c;
}

export function rankTerms(countsByTalk: Record<string, TermCounts>, minMentions = 2, limit = 300): IndexEntry[] {
  const agg = new Map<string, { mentions: number; talks: string[] }>();
  for (const [talk, counts] of Object.entries(countsByTalk)) {
    for (const [term, n] of Object.entries(counts)) {
      const a = agg.get(term) ?? { mentions: 0, talks: [] };
      a.mentions += n;
      a.talks.push(talk);
      agg.set(term, a);
    }
  }
  return [...agg]
    .filter(([, a]) => a.mentions >= minMentions)
    .sort(([ta, a], [tb, b]) => b.talks.length - a.talks.length || b.mentions - a.mentions || ta.localeCompare(tb))
    .slice(0, limit)
    .map(([term, a]): IndexEntry => ({ term, kind: 'keyword', variants: [term], mentions: a.mentions, talks: a.talks.sort(), status: 'discovered' }));
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function countFamily(variants: string[], paragraphsByTalk: Record<string, string[]>): { mentions: number; talks: string[] } {
  const pattern = [...variants].sort((a, b) => b.length - a.length).map(escape).join('|');
  const re = new RegExp(`(?<![\\p{L}'])(?:${pattern})(?![\\p{L}'])`, 'giu');
  let mentions = 0;
  const talks: string[] = [];
  for (const [talk, paragraphs] of Object.entries(paragraphsByTalk)) {
    const text = paragraphs.join('\n').toLowerCase().replace(/[‘’]/g, "'");
    const n = text.match(re)?.length ?? 0;
    if (n > 0) {
      mentions += n;
      talks.push(talk);
    }
  }
  return { mentions, talks: talks.sort() };
}
```

- [ ] **Step 5: Run tests**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git -C C:/Dev/gc-findings add src/stopwords.ts src/count.ts tests/count.test.ts
git -C C:/Dev/gc-findings commit -m "Word and phrase counts, discovery ranking, family counts"
```

---

### Task 5: Quote check and validation

**Files:**
- Create: `src/quotes.ts`
- Test: `tests/quotes.test.ts`

**Interfaces:**
- Consumes: `TalkFile`, `Finding`, `Discovery`, `FINDING_TYPES`, `ARC_BEATS` from `src/types.ts`
- Produces: `normalize(s: string): string`; `quoteInText(quote: string, corpus: string): boolean`; `interface Rejection { talk: string; finding: string; reason: string }`; `checkTalk(talk: TalkFile, corpus: string): { kept: Finding[]; rejected: Rejection[]; errors: string[] }`; `checkDiscoveries(discoveries: Discovery[], talks: Record<string, TalkFile>): string[]`

- [ ] **Step 1: Write the failing test `tests/quotes.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { checkDiscoveries, checkTalk, quoteInText } from '../src/quotes.ts';
import type { Finding, TalkFile } from '../src/types.ts';

const corpus = 'According to this plan, “this life is the time for [us] to prepare to meet God” (Alma 34:32).\nThe Savior’s love — it never fails.';

describe('quoteInText', () => {
  it('matches straight-typed quotes against curly quotes, apostrophes and dashes', () => {
    expect(quoteInText(`The Savior's love - it never fails`, corpus)).toBe(true);
  });
  it('matches across an ellipsis when the parts appear in order', () => {
    expect(quoteInText('this life is the time ... to meet God', corpus)).toBe(true);
    expect(quoteInText('to meet God ... this life is the time', corpus)).toBe(false);
  });
  it('treats a bracketed edit as a gap', () => {
    expect(quoteInText('the time for [you] to prepare', corpus)).toBe(true);
  });
  it('ignores case and edge punctuation, rejects invented words', () => {
    expect(quoteInText('"THE SAVIOR’S LOVE."', corpus)).toBe(true);
    expect(quoteInText('the Savior’s love never ends', corpus)).toBe(false);
  });
});

const talk = (findings: Finding[], arc: TalkFile['arc'] = []): TalkFile => ({
  id: 't1', kind: 'talk', speaker: 'S', role: 'R', title: 'T', session: 'S', order: 1, url: 'u',
  summary: '', audience: null, arc, orientation: null, pronouns: { i: 0, we: 0, you: 0 }, findings,
});

describe('checkTalk', () => {
  it('keeps good findings and rejects bad ones with reasons', () => {
    const r = checkTalk(talk([
      { id: 'c-1', type: 'promise', quote: 'it never fails', basis: 'interpreted', note: 'Love endures' },
      { id: 'c-2', type: 'invitation', quote: 'go and do', basis: 'interpreted', note: 'x' },
      { id: 'c-3', type: 'revelation', quote: 'to meet God', basis: 'interpreted', note: 'A prophecy' },
      { id: 'c-4', type: 'image', quote: 'to meet God', basis: 'interpreted' },
      { id: 'c-1', type: 'promise', quote: 'it never fails', basis: 'interpreted', note: 'dup' },
    ]), corpus);
    expect(r.kept.map((f) => f.id)).toEqual(['c-1']);
    expect(r.rejected.map((x) => [x.finding, x.reason])).toEqual([
      ['c-2', 'quote not found in talk'],
      ['c-3', 'revelation must be interpreted and its note must start "Reads as"'],
      ['c-4', 'interpreted finding needs a note'],
      ['c-1', 'duplicate id'],
    ]);
  });

  it('reports unknown arc beats and dangling pairs as errors', () => {
    const r = checkTalk(talk(
      [{ id: 'c-1', type: 'invitation', quote: 'to meet God', basis: 'interpreted', note: 'x', paired_with: 'c-9' }],
      ['story', 'sermon' as never],
    ), corpus);
    expect(r.errors).toEqual(['t1: unknown arc beat "sermon"', 't1/c-1: paired_with "c-9" not found']);
  });
});

describe('checkDiscoveries', () => {
  it('flags evidence that points at a missing talk or finding', () => {
    const t = talk([{ id: 'c-1', type: 'promise', quote: 'it never fails', basis: 'interpreted', note: 'x' }]);
    expect(checkDiscoveries([{ title: 'D', body: 'b', evidence: [{ talk: 't1', finding: 'c-1' }, { talk: 't1', finding: 'c-7' }, { talk: 't9', finding: 'c-1' }] }], { t1: t }))
      .toEqual(['"D": no finding t1/c-7', '"D": no finding t9/c-1']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test tests/quotes.test.ts`
Expected: FAIL, cannot find `../src/quotes.ts`.

- [ ] **Step 3: Write `src/quotes.ts`**

```ts
import { ARC_BEATS, FINDING_TYPES } from './types.ts';
import type { Discovery, Finding, TalkFile } from './types.ts';

export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const EDGE = /^[\s"'.,;:!?-]+|[\s"'.,;:!?-]+$/g;

export function quoteInText(quote: string, corpus: string): boolean {
  const text = normalize(corpus);
  const segments = normalize(quote)
    .split(/\.\.\.|…|\[[^\]]*\]/)
    .map((s) => s.replace(EDGE, ''))
    .filter((s) => s.length > 0);
  if (segments.length === 0) return false;
  let from = 0;
  for (const seg of segments) {
    const at = text.indexOf(seg, from);
    if (at < 0) return false;
    from = at + seg.length;
  }
  return true;
}

export interface Rejection { talk: string; finding: string; reason: string }

function reasonToReject(f: Finding, corpus: string, seen: Set<string>): string | null {
  if (!(FINDING_TYPES as readonly string[]).includes(f.type)) return `unknown type "${f.type}"`;
  if (seen.has(f.id)) return 'duplicate id';
  if (!f.quote?.trim()) return 'empty quote';
  if (!quoteInText(f.quote, corpus)) return 'quote not found in talk';
  if (f.type === 'revelation' && (f.basis !== 'interpreted' || !/^reads as\b/i.test(f.note ?? ''))) {
    return 'revelation must be interpreted and its note must start "Reads as"';
  }
  if (f.basis === 'interpreted' && !f.note?.trim()) return 'interpreted finding needs a note';
  return null;
}

export function checkTalk(talk: TalkFile, corpus: string): { kept: Finding[]; rejected: Rejection[]; errors: string[] } {
  const kept: Finding[] = [];
  const rejected: Rejection[] = [];
  const seen = new Set<string>();
  for (const f of talk.findings) {
    const reason = reasonToReject(f, corpus, seen);
    if (reason) {
      rejected.push({ talk: talk.id, finding: f.id, reason });
    } else {
      kept.push(f);
      seen.add(f.id);
    }
  }

  const errors: string[] = [];
  for (const beat of talk.arc) {
    if (!(ARC_BEATS as readonly string[]).includes(beat)) errors.push(`${talk.id}: unknown arc beat "${beat}"`);
  }
  for (const f of kept) {
    if (f.paired_with && !seen.has(f.paired_with)) errors.push(`${talk.id}/${f.id}: paired_with "${f.paired_with}" not found`);
  }
  return { kept, rejected, errors };
}

export function checkDiscoveries(discoveries: Discovery[], talks: Record<string, TalkFile>): string[] {
  const errors: string[] = [];
  for (const d of discoveries) {
    for (const e of d.evidence) {
      if (!talks[e.talk]?.findings.some((f) => f.id === e.finding)) errors.push(`"${d.title}": no finding ${e.talk}/${e.finding}`);
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C C:/Dev/gc-findings add src/quotes.ts tests/quotes.test.ts
git -C C:/Dev/gc-findings commit -m "Quote check and finding validation"
```

---

### Task 6: Skeleton and index merge

**Files:**
- Create: `src/skeleton.ts`
- Test: `tests/skeleton.test.ts`

**Interfaces:**
- Consumes: `ParsedTalk`, `TalkFile`, `Finding`, `IndexEntry` from `src/types.ts`; `countFamily` from `src/count.ts`
- Produces: `exactFindings(parsed: ParsedTalk): Finding[]`; `type SkeletonBase = Omit<TalkFile, 'findings' | 'summary' | 'audience' | 'arc' | 'orientation'>`; `mergeSkeleton(existing: TalkFile | null, base: SkeletonBase, exact: Finding[]): TalkFile`; `mergeIndex(existing: IndexEntry[], discovered: IndexEntry[], paragraphsByTalk: Record<string, string[]>): IndexEntry[]`

- [ ] **Step 1: Write the failing test `tests/skeleton.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { exactFindings, mergeIndex, mergeSkeleton } from '../src/skeleton.ts';
import type { ParsedTalk, TalkFile } from '../src/types.ts';

const parsed: ParsedTalk = {
  speaker: 'S', role: 'R', title: 'T', paragraphs: [],
  citations: [{ ref: 'Alma 42:8', href: 'h', inText: true }, { ref: 'Alma 34:32', href: 'h', inText: false }],
  notes: [
    { marker: '1.', text: 'See Dallin H. Oaks, “Divine Helps,” May 2025.', refs: [{ type: 'cross-ref', href: 'h', text: 'Divine Helps' }] },
    { marker: '2.', text: 'Alma 34:32.', refs: [{ type: 'scripture-ref', href: 'h', text: 'Alma 34:32' }] },
  ],
};

const base = { id: 't1', kind: 'talk' as const, speaker: 'S', role: 'R', title: 'T', session: 'S', order: 1, url: 'u', pronouns: { i: 1, we: 2, you: 3 } };

describe('exactFindings', () => {
  it('turns citations into scripture findings and cross-ref footnotes into source findings', () => {
    expect(exactFindings(parsed)).toEqual([
      { id: 'x-s1', type: 'scripture', quote: 'Alma 42:8', basis: 'exact', ref: 'Alma 42:8', spoken: true },
      { id: 'x-s2', type: 'scripture', quote: 'Alma 34:32', basis: 'exact', ref: 'Alma 34:32', spoken: false },
      { id: 'x-n1', type: 'source', quote: 'See Dallin H. Oaks, “Divine Helps,” May 2025.', basis: 'exact', ref: 'Divine Helps' },
    ]);
  });
});

describe('mergeSkeleton', () => {
  it('starts empty when there is no existing file', () => {
    const t = mergeSkeleton(null, base, exactFindings(parsed));
    expect(t).toMatchObject({ summary: '', audience: null, arc: [], orientation: null });
    expect(t.findings).toHaveLength(3);
  });

  it('keeps Claude findings, talk-level fields, and Claude edits to code findings', () => {
    const existing: TalkFile = {
      ...base, summary: 'Sum', audience: { who: 'youth' }, arc: ['story'], orientation: { past: 1, present: 0, future: 0 },
      findings: [
        { id: 'x-n1', type: 'prophet', quote: 'old', basis: 'exact', ref: 'Divine Helps', note: 'Current President' },
        { id: 'x-s9', type: 'scripture', quote: 'gone', basis: 'exact' },
        { id: 'c-1', type: 'promise', quote: 'q', basis: 'interpreted', note: 'n' },
      ],
    };
    const t = mergeSkeleton(existing, base, exactFindings(parsed));
    expect(t.summary).toBe('Sum');
    expect(t.arc).toEqual(['story']);
    expect(t.findings.map((f) => f.id)).toEqual(['x-s1', 'x-s2', 'x-n1', 'c-1']);
    expect(t.findings.find((f) => f.id === 'x-n1')).toMatchObject({ type: 'prophet', note: 'Current President', quote: 'See Dallin H. Oaks, “Divine Helps,” May 2025.' });
  });
});

describe('mergeIndex', () => {
  it('keeps curated entries with recounted families and drops discovered terms they absorbed', () => {
    const merged = mergeIndex(
      [
        { term: 'Peace', kind: 'keyword', variants: ['peace', 'peacemakers'], mentions: 0, talks: [], status: 'proposed_family' },
        { term: 'Forgiveness', kind: 'subject', variants: [], mentions: null, talks: ['a'], status: 'approved' },
        { term: 'old', kind: 'keyword', variants: ['old'], mentions: 9, talks: ['a'], status: 'discovered' },
      ],
      [
        { term: 'peace', kind: 'keyword', variants: ['peace'], mentions: 2, talks: ['a'], status: 'discovered' },
        { term: 'temple', kind: 'keyword', variants: ['temple'], mentions: 2, talks: ['a'], status: 'discovered' },
      ],
      { a: ['Peace, peace.'], b: ['Blessed are the peacemakers.'] },
    );
    expect(merged.map((e) => [e.term, e.mentions, e.talks])).toEqual([
      ['Peace', 3, ['a', 'b']],
      ['Forgiveness', null, ['a']],
      ['temple', 2, ['a']],
    ]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm test tests/skeleton.test.ts`
Expected: FAIL, cannot find `../src/skeleton.ts`.

- [ ] **Step 3: Write `src/skeleton.ts`**

```ts
import { countFamily } from './count.ts';
import type { Finding, IndexEntry, ParsedTalk, TalkFile } from './types.ts';

export type SkeletonBase = Omit<TalkFile, 'findings' | 'summary' | 'audience' | 'arc' | 'orientation'>;

export function exactFindings(parsed: ParsedTalk): Finding[] {
  const out: Finding[] = parsed.citations.map((c, i): Finding => ({
    id: `x-s${i + 1}`, type: 'scripture', quote: c.ref, basis: 'exact', ref: c.ref, spoken: c.inText,
  }));
  for (const n of parsed.notes) {
    const cross = n.refs.find((r) => r.type === 'cross-ref');
    if (cross) out.push({ id: `x-n${n.marker.replace(/\D/g, '')}`, type: 'source', quote: n.text, basis: 'exact', ref: cross.text });
  }
  return out;
}

export function mergeSkeleton(existing: TalkFile | null, base: SkeletonBase, exact: Finding[]): TalkFile {
  const prior = new Map((existing?.findings ?? []).map((f) => [f.id, f]));
  const code = exact.map((f) => {
    const p = prior.get(f.id);
    if (!p) return f;
    const kept: Partial<Finding> = { type: p.type };
    if (p.note !== undefined) kept.note = p.note;
    if (p.detail !== undefined) kept.detail = p.detail;
    if (p.terms !== undefined) kept.terms = p.terms;
    return { ...f, ...kept };
  });
  const claude = (existing?.findings ?? []).filter((f) => !f.id.startsWith('x-'));
  return {
    ...base,
    summary: existing?.summary ?? '',
    audience: existing?.audience ?? null,
    arc: existing?.arc ?? [],
    orientation: existing?.orientation ?? null,
    findings: [...code, ...claude],
  };
}

export function mergeIndex(existing: IndexEntry[], discovered: IndexEntry[], paragraphsByTalk: Record<string, string[]>): IndexEntry[] {
  const curated = existing
    .filter((e) => e.status !== 'discovered')
    .map((e) => (e.kind === 'subject' || e.variants.length === 0 ? e : { ...e, ...countFamily(e.variants, paragraphsByTalk) }));
  const absorbed = new Set(curated.flatMap((e) => e.variants.map((v) => v.toLowerCase())));
  return [...curated, ...discovered.filter((d) => !absorbed.has(d.term))];
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git -C C:/Dev/gc-findings add src/skeleton.ts tests/skeleton.test.ts
git -C C:/Dev/gc-findings commit -m "Skeleton and index merge that preserve Claude's work"
```

---

### Task 7: Command-line scripts, first real run

**Files:**
- Create: `scripts/fetch.ts`, `scripts/skeleton.ts`, `scripts/check-quotes.ts`, `src/files.ts`
- Output: `data/manifest.json`, `data/raw/*.json` (gitignored), `data/talks/*.json`, `data/counts/*.json`, `data/index.json`

**Interfaces:**
- Consumes: everything from Tasks 1-6
- Produces: `data/manifest.json` as `{ conference: string; entries: ManifestEntry[]; pilot: string[]; hymn: { slug: string; uri: string; title: string } | null }`; `readJson<T>(path: string, fallback: T): Promise<T>`; `writeJson(path: string, value: unknown): Promise<void>`; `loadRaw(slug: string): Promise<RawContent>`

- [ ] **Step 1: Write `src/files.ts`**

```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ManifestEntry, RawContent } from './types.ts';

export interface Manifest {
  conference: string;
  entries: ManifestEntry[];
  pilot: string[];
  hymn: { slug: string; uri: string; title: string } | null;
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw e;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n');
}

export const API = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=';

export async function fetchContent(uri: string): Promise<RawContent> {
  const res = await fetch(API + uri, { headers: { 'user-agent': 'gc-findings personal study project' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${uri}`);
  return (await res.json()) as RawContent;
}

export async function loadRaw(slug: string): Promise<RawContent> {
  const raw = await readJson<RawContent | null>(`data/raw/${slug}.json`, null);
  if (!raw) throw new Error(`data/raw/${slug}.json missing - run pnpm fetch first`);
  return raw;
}
```

- [ ] **Step 2: Write `scripts/fetch.ts`**

```ts
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
```

- [ ] **Step 3: Write `scripts/skeleton.ts`**

```ts
import { countPronouns, countTerms, rankTerms } from '../src/count.ts';
import { loadRaw, readJson, writeJson, type Manifest } from '../src/files.ts';
import { parseTalk } from '../src/parse-talk.ts';
import { exactFindings, mergeIndex, mergeSkeleton } from '../src/skeleton.ts';
import type { IndexEntry, TalkFile, TermCounts } from '../src/types.ts';

const manifest = await readJson<Manifest | null>('data/manifest.json', null);
if (!manifest) throw new Error('data/manifest.json missing - run pnpm fetch first');

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
```

- [ ] **Step 4: Write `scripts/check-quotes.ts`**

```ts
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
```

- [ ] **Step 5: Write `scripts/print-talk.ts`** (used by READ in Task 9)

```ts
import { loadRaw } from '../src/files.ts';
import { parseTalk } from '../src/parse-talk.ts';

const slug = process.argv[2];
if (!slug) throw new Error('usage: node scripts/print-talk.ts <slug>');
const p = parseTalk(await loadRaw(slug));
console.log(`${p.title}\n${p.speaker} - ${p.role}\n`);
console.log(p.paragraphs.join('\n\n'));
console.log('\nNOTES');
for (const n of p.notes) console.log(`${n.marker} ${n.text}`);
```

- [ ] **Step 5b: Type check**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Fetch the conference**

Run: `pnpm fetch`
Expected last line: `37 talks fetched. Pilot: 12gong, 48schmeil, 49oaks, 59gilbert, 510oaks` (the count can differ by one or two if the manifest lists other business items; the pilot list must be exactly these five). If the pilot list differs, stop and report it to Patrick before continuing.

- [ ] **Step 7: Build skeletons and check**

Run: `pnpm skeleton && pnpm check`
Expected: `Skeletons written for 5 items; index rebuilt.` then `N findings kept, 0 rejected this run.` A rejection here means a parser bug in exact findings: fix it in `src/parse-talk.ts` or `src/skeleton.ts` with a failing test first.

Spot-check `data/talks/48schmeil.json`: speaker `Ciro Schmeil`, `x-s` findings include `Alma 42:8` with `spoken: true`, and `x-n1` is a `source` finding naming Dallin H. Oaks. Spot-check that `data/index.json` has terms like `jesus christ` near the top.

- [ ] **Step 8: Commit**

```bash
git -C C:/Dev/gc-findings add scripts src/files.ts data/manifest.json data/talks data/counts data/index.json data/rejected.json
git -C C:/Dev/gc-findings commit -m "Fetch, skeleton and quote-check scripts; first pilot run"
```

---

### Task 8: The closing hymn

**Files:**
- Modify: `data/manifest.json` (via `pnpm fetch --hymn=...`)
- Output: `data/raw/hymn-<slug>.json`, `data/talks/hymn-<slug>.json`

- [ ] **Step 1: Identify the hymn**

The Church site's session pages do not list hymns. Search the web for the October 2026 general conference Sunday afternoon session closing hymn (the Church Newsroom and Deseret News session recaps name the music). Present the hymn title and its source link to Patrick and wait for his confirmation.

- [ ] **Step 2: Find its Gospel Library uri**

Search the Church site for the hymn (Gospel Library hymns live under `/study/music/...` or `/media/music/songs/...`). Confirm the content API serves it:

```bash
curl -s -A "Mozilla/5.0" "https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=<uri>" | head -c 600
```

Expected: JSON with `content.body` containing the verses. If the API does not serve it, ask Patrick, and as the fallback write `data/raw/hymn-<slug>.json` by hand in the `RawContent` shape: `{ "content": { "body": "<h1>Title</h1><div class=\"body-block\"><p>verse 1 ...</p>...</div>", "footnotes": {} } }`, with the scriptures the hymnbook lists for it added as footnotes with `scripture-ref` entries. Then add `"hymn": { "slug": "hymn-<slug>", "uri": "<uri>", "title": "<title>" }` to `data/manifest.json` and skip Step 3.

- [ ] **Step 3: Fetch it**

Run: `pnpm fetch --hymn=<uri>`
Expected: the pilot line ends with `+ hymn-<slug>`.

- [ ] **Step 4: Skeleton and check**

Run: `pnpm skeleton && pnpm check`
Expected: `Skeletons written for 6 items`, 0 rejected. `data/talks/hymn-<slug>.json` has `kind: "hymn"` and paragraphs (verses) counted.

- [ ] **Step 5: Commit**

```bash
git -C C:/Dev/gc-findings add data/manifest.json data/talks data/counts data/index.json
git -C C:/Dev/gc-findings commit -m "Add the closing hymn"
```

---

### Task 9: READ - interpreted findings, talk by talk

**Files:**
- Create: `docs/rubric.md`
- Modify: `data/talks/*.json` (six files)

This task is Claude's reading, not code. The rubric makes it repeatable and reviewable.

- [ ] **Step 1: Write `docs/rubric.md`**

````md
# Reading rubric

Every finding: an exact `quote` of 40 words or fewer from the talk, the right `type`, `basis`, and for `interpreted` a one-line `note` saying what Claude read. Ids `c-1`, `c-2`... per talk. Never edit `x-` findings except `type`, `note`, `detail`, `terms`.

## Talk-level fields

| Field | Rule |
|---|---|
| `summary` | Three sentences: what it teaches, the main story or image, what it asks. Plain words |
| `audience` | `who` in plain words; `quote` only when the speaker names the audience ("my young friends") |
| `arc` | The beats in order, from: story, principle, scripture, quote, list, invitation, promise, testimony. Repeat a beat if it recurs |
| `orientation` | Rough share (sums to 1) of past (history, pioneers, ancestors, scripture events), present, future (Second Coming, eternity, "the days ahead") |

## Finding types

| Type | Include when | `detail` |
|---|---|---|
| `invitation` | The speaker asks the listener to act: "I invite", "I urge", "let us", "will you", "I plead" | `{ "action": "<verb phrase>" }` |
| `promise` | The speaker assures a blessing or outcome: "I promise", "you will", "as you ..., you will" | `{ "blessing": "<what>" }`; set `paired_with` on the invitation it answers |
| `list` | Enumerated items: "three things", numbered or ordinal lists | `{ "count": "<n>", "items": ["..."], "purpose": "<what the list is for>" }` |
| `testimony` | A formal witness, usually the closing "I testify" / "I bear witness" | `{ "of": "<what is testified of>" }` |
| `revelation` | A statement that reads as prophetic, revelatory, or newly announced direction. `basis` interpreted; `note` starts "Reads as" | `{ "kind": "prophecy" or "direction" or "warning" }` |
| `prophet` | Quotes or cites President Dallin H. Oaks (current Church President) | `{ "source": "<talk or event>" }` |
| `past_prophet` | Quotes or cites a previous Church President (Russell M. Nelson, Thomas S. Monson, Gordon B. Hinckley, ... Joseph Smith) | `{ "who": "<name>" }` |
| `christ` | Words of Jesus Christ quoted from scripture | `{ "where": "<reference>" }` |
| `source` | Any other quoted voice: apostles, authors, hymns, poets, friends | `{ "who": "<name>" }` |
| `story` | A narrative with people and events | `{ "story_type": "personal" or "family" or "scripture" or "church history" or "missionary" or "other", "about": "<one line>" }` |
| `relationship` | A named relationship in a story: "my wife, who passed away" | `{ "who": "<relation>", "state": "living" or "deceased" or "unknown" }` |
| `image` | A concrete picture used to teach: boat, water, light, path, rock, seed, fruit, building, race | `{ "image": "<noun>", "family": "water" or "light" or "path" or "rock" or "growth" or "building" or "body" or "other", "carries": "<the teaching it carries>" }` |
| `place` | A named place | `{ "place": "<name>", "country": "<country>" }` |
| `name_of_christ` | A title or name used for Christ other than "Jesus Christ" and "the Savior" | `{ "name": "<title>" }` |

Code-written `source` findings (`x-n...`) that cite the current President become `prophet`; previous Presidents become `past_prophet`.
````

- [ ] **Step 2: Read the first talk**

Read the full text of `12gong` with `node scripts/print-talk.ts 12gong`. Fill `summary`, `audience`, `arc`, `orientation` and add `c-` findings following the rubric. Retype `x-n` findings per the rubric's last line.

- [ ] **Step 3: Check it**

Run: `pnpm check`
Expected: exit 0. For each rejection printed, fix the quote to the exact words in the text and re-add the finding, or drop it.

- [ ] **Step 4: Repeat Steps 2-3 for `48schmeil`, `49oaks`, `59gilbert`, `510oaks`, and the hymn**

The hymn gets `summary`, `audience`, and findings of types `image`, `name_of_christ`, `promise`, `christ`, `testimony` where they apply; `arc` stays `[]` and `orientation` may be filled.

- [ ] **Step 5: Re-run the skeleton to prove nothing is lost**

Run: `pnpm skeleton && pnpm check`
Expected: same finding counts as before the skeleton run, exit 0.

- [ ] **Step 6: Commit**

```bash
git -C C:/Dev/gc-findings add docs/rubric.md data/talks data/rejected.json
git -C C:/Dev/gc-findings commit -m "Pilot READ: interpreted findings for six items"
```

---

### Task 10: CONNECT and DISCOVER

**Files:**
- Modify: `data/index.json`, `data/talks/*.json` (`paired_with`, `terms`)
- Create: `data/discoveries.json`

- [ ] **Step 1: Pair invitations and promises**

Within each talk, set `paired_with` on each `invitation` to the id of the `promise` that answers it, when one does. Leave unanswered invitations unpaired.

- [ ] **Step 2: Propose families**

From the top 150 of `data/index.json`, group variants into families (e.g. `{ "term": "Peace", "kind": "keyword", "variants": ["peace", "peacemakers", "peacemaker", "prince of peace", "peaceful"], "status": "proposed_family", "mentions": 0, "talks": [] }`). Add one `kind: "image"` entry per image family found in READ (variants = the image nouns), and `kind: "subject"` entries (variants `[]`, `mentions: null`, `talks` filled by hand) for themes several talks carry without a shared word. Then run `pnpm skeleton` to recount families.

- [ ] **Step 3: Look for cross-talk patterns**

Go through, in this order, and note what is true:
1. Terms and families touched by 4+ of the 6 items.
2. Terms concentrated in one talk (high mentions, one talk).
3. Shared images across speakers; bookends (an image that opens and closes a talk); images tied to a scripture.
4. Echoes: a talk quoting or naming another speaker from this conference.
5. Scriptures cited by 2+ talks; balance across Bible, Book of Mormon, Doctrine and Covenants, Pearl of Great Price.
6. Invitation-promise pairs: what is promised for what.
7. Arc shapes: which talks share an arc; which break the usual shape.
8. Pronoun balance (I / we / you) by talk.
9. How the President's two talks relate to the others.

- [ ] **Step 4: Write `data/discoveries.json`**

About 10 entries, most surprising first, each `{ "title": "<one line>", "body": "<two or three sentences, plain>", "evidence": [{ "talk": "<slug>", "finding": "<id>" }] }` with at least one evidence item. Counts in a body must come from `data/index.json`.

- [ ] **Step 5: Check**

Run: `pnpm check`
Expected: exit 0 (every evidence link resolves).

- [ ] **Step 6: Commit**

```bash
git -C C:/Dev/gc-findings add data
git -C C:/Dev/gc-findings commit -m "Pilot CONNECT and DISCOVER"
```

---

### Task 11: PUBLISH to Notion

**Files:**
- Create: `data/notion-map.json` (`{ "page": "<id>", "databases": { "talks": "<id>", "findings": "<id>", "index": "<id>" }, "rows": { "<talk or finding or term key>": "<page id>" } }`)

- [ ] **Step 1: Load the Notion tools**

Load the Notion connector tool schemas with ToolSearch: `select:mcp__notion__notion-create-pages,mcp__notion__notion-create-database,mcp__notion__notion-create-view,mcp__notion__notion-update-page,mcp__notion__notion-fetch,mcp__notion__notion-search`.

- [ ] **Step 2: Create the page and databases**

Create a private page **GC October 2026**, then three databases under it:

| Database | Properties |
|---|---|
| Talks | Name (title), Talk ID (text), Kind (select: talk, hymn), Speaker (text), Role (text), Session (select), Order (number), Audience (text), Arc (text, beats joined with " > "), Summary (text), I / We / You (text), Link (url), My notes (text) |
| Findings | Quote (title), Finding ID (text, `<talk>/<id>`), Type (select, the 15 types), Basis (select: exact, interpreted), Note (text), Ref (text), In talk text (checkbox, from `spoken`), Detail (text, `key: value; ...`), Paired with (text, the paired promise's quote), Talk (relation to Talks), My notes (text) |
| Index | Term (title), Kind (select: keyword, subject, image), Variants (text), Mentions (number), Talks touched (number), Talks (relation to Talks), Status (select: discovered, proposed_family, approved, rejected) |

Record every id in `data/notion-map.json`.

- [ ] **Step 3: Write the rows**

One Talks row per talk file; one Findings row per finding; Index rows for every curated entry plus the top 50 discovered. For each Talks row, write the page body: Summary, then one toggle heading per finding type present with its quotes. Record each row id in `data/notion-map.json` under `rows`. Never send the My notes property.

- [ ] **Step 4: Create the views**

Findings: Testimonies (Type = testimony), Invitations -> Promises (Type = invitation; show Paired with), Scriptures (Type = scripture; group by In talk text), Prophets (Type is prophet, past_prophet or christ), Stories (Type is story or relationship), Images (Type = image), Lists (Type = list), Interpreted only (Basis = interpreted). Index: Themes (sort Talks touched desc, then Mentions desc), Families to approve (Status = proposed_family). Talks: In order (sort Order asc).

- [ ] **Step 5: Write "What I found"**

A child page at the top of **GC October 2026**: one numbered item per entry in `data/discoveries.json` (title in bold, body, then links to the evidence rows), then a "Families to approve" section linking the Index view.

- [ ] **Step 6: Re-publish rule (for later runs)**

Before writing any row, look it up in `data/notion-map.json`; update it if present, create it if not. Never include My notes in an update. Write this rule as the first section of `docs/publish.md` together with the property tables above, so the next run follows it.

- [ ] **Step 7: Verify on the phone-sized view**

Fetch the page and each database with `notion-fetch` and confirm: 6 Talks rows, Findings count equals the total from `pnpm check`, every view returns only its type. Then give Patrick the page link.

- [ ] **Step 8: Commit**

```bash
git -C C:/Dev/gc-findings add data/notion-map.json docs/publish.md
git -C C:/Dev/gc-findings commit -m "Publish the pilot to Notion"
```

---

### Task 12: Pilot review with Patrick

**Files:**
- Create: `docs/pilot-review.md`

- [ ] **Step 1: Walk the success criteria with Patrick**

1. He opens one talk page and says whether it caught him up.
2. He opens three Findings views on his phone.
3. `pnpm check` shows 0 rejected on the final run.
4. He reads "What I found" and marks which items he did not expect.
5. For each of the 15 finding types and each talk-level field: keep, cut, or change.

- [ ] **Step 2: Record the outcome**

Write `docs/pilot-review.md`: his answers to 1-4, the keep / cut / change table for 5, approved and rejected families (update their `status` in `data/index.json`), and the changes to make before the full-conference run.

- [ ] **Step 3: Commit**

```bash
git -C C:/Dev/gc-findings add docs/pilot-review.md data/index.json
git -C C:/Dev/gc-findings commit -m "Pilot review"
```
