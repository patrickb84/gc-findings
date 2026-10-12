import type { TalkFile } from './types.ts';

const VOLUMES = {
  'Old Testament': [
    'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel',
    '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs',
    'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel',
    'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi',
  ],
  'New Testament': [
    'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians',
    'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon',
    'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation',
  ],
  'Book of Mormon': [
    'Title Page', '1 Nephi', '2 Nephi', 'Jacob', 'Enos', 'Jarom', 'Omni', 'Words of Mormon', 'Mosiah', 'Alma',
    'Helaman', '3 Nephi', '4 Nephi', 'Mormon', 'Ether', 'Moroni',
  ],
  'Doctrine and Covenants': ['Doctrine and Covenants', 'Official Declaration'],
  'Pearl of Great Price': ['Moses', 'Abraham', 'Joseph Smith—Matthew', 'Joseph Smith—History', 'Articles of Faith'],
} as const;

export type Volume = keyof typeof VOLUMES;
const VOLUME_ORDER = Object.keys(VOLUMES) as Volume[];

export interface Span { chapter: number; verses: number[] | null }
export interface ParsedRef { book: string; volume: Volume | null; spans: Span[] }

export interface ScriptureRow {
  ref: string;
  book: string;
  volume: Volume | null;
  citations: { talk: string; finding: string; spoken: boolean }[];
  talks: string[];
  spoken: boolean;
  overlaps: string[];
}

// References spoken in the talk text rather than written as book chapter:verse.
const SPOKEN_FORMS: Record<string, ParsedRef> = {
  'title page of the book of mormon': { book: 'Title Page', volume: 'Book of Mormon', spans: [] },
};

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth'];

// A single psalm is cited as "Psalm 55:22"; quoted footnotes abbreviate "D&C".
const BOOK_ALIASES: Record<string, string> = { Psalm: 'Psalms', 'D&C': 'Doctrine and Covenants' };

function volumeOf(book: string): Volume | null {
  return VOLUME_ORDER.find((v) => (VOLUMES[v] as readonly string[]).includes(book)) ?? null;
}

// Hyphen, figure dash (U+2012) and en dash: Church text uses all three in ranges.
const DASH = '[-‒–]';

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function numbers(list: string): number[] {
  return list.split(',').flatMap((part) => {
    const [from, to] = part.trim().split(new RegExp(DASH)).map(Number);
    return to === undefined ? [from] : range(from, to);
  });
}

export function parseRef(ref: string): ParsedRef {
  // Church text writes "2 Nephi" with a non-breaking space; \s matches it. A spoken link can
  // carry the sentence's comma ("41st chapter of Isaiah,").
  const clean = ref.replace(/\s+/g, ' ').trim().replace(/[,;.]+$/, '');
  const spoken = SPOKEN_FORMS[clean.toLowerCase()];
  if (spoken) return spoken;
  const article = clean.match(/^(\w+) article of faith$/i);
  const nth = article ? ORDINALS.indexOf(article[1].toLowerCase()) + 1 : 0;
  if (nth) return { book: 'Articles of Faith', volume: 'Pearl of Great Price', spans: [{ chapter: 1, verses: [nth] }] };
  const said = clean.match(/^(.+?) chapter (\d+)$/i);
  if (said) return { book: said[1], volume: volumeOf(said[1]), spans: [{ chapter: Number(said[2]), verses: null }] };
  const chapterOf = clean.match(/^(\d+)(?:st|nd|rd|th) chapter of (.+)$/i);
  if (chapterOf) return { book: chapterOf[2], volume: volumeOf(chapterOf[2]), spans: [{ chapter: Number(chapterOf[1]), verses: null }] };
  const m = clean.match(new RegExp(`^(.+?) (\\d+)(?:${DASH}(\\d+))?(?::(.+))?$`));
  if (!m) return { book: clean, volume: volumeOf(clean), spans: [] };
  const [, written, first, last, verses] = m;
  const book = BOOK_ALIASES[written] ?? written;
  const spans = verses
    ? [{ chapter: Number(first), verses: numbers(verses) }]
    : range(Number(first), Number(last ?? first)).map((chapter) => ({ chapter, verses: null }));
  return { book, volume: volumeOf(book), spans };
}

export function overlaps(a: ParsedRef, b: ParsedRef): boolean {
  if (a.book !== b.book) return false;
  return a.spans.some((x) => b.spans.some((y) =>
    x.chapter === y.chapter && (x.verses === null || y.verses === null || x.verses.some((v) => y.verses!.includes(v)))));
}

function sortKey(p: ParsedRef): number[] {
  const volume = p.volume ? VOLUME_ORDER.indexOf(p.volume) : VOLUME_ORDER.length;
  const book = p.volume ? (VOLUMES[p.volume] as readonly string[]).indexOf(p.book) : 0;
  const first = p.spans[0];
  return [volume, book, first?.chapter ?? 0, first?.verses?.[0] ?? 0];
}

export function buildScriptureTable(talks: TalkFile[]): ScriptureRow[] {
  const byRef = new Map<string, ScriptureRow & { parsed: ParsedRef }>();
  for (const t of talks) {
    for (const f of t.findings) {
      if (f.type !== 'scripture' || !f.ref) continue;
      let row = byRef.get(f.ref);
      if (!row) {
        const parsed = parseRef(f.ref);
        row = { ref: f.ref, book: parsed.book, volume: parsed.volume, citations: [], talks: [], spoken: false, overlaps: [], parsed };
        byRef.set(f.ref, row);
      }
      const spoken = f.spoken ?? false;
      row.citations.push({ talk: t.id, finding: f.id, spoken });
      if (!row.talks.includes(t.id)) row.talks.push(t.id);
      row.spoken ||= spoken;
    }
  }
  const rows = [...byRef.values()];
  for (const row of rows) {
    row.overlaps = rows.filter((o) => o !== row && overlaps(row.parsed, o.parsed)).map((o) => o.ref);
  }
  return rows
    .sort((a, b) => compareKeys(sortKey(a.parsed), sortKey(b.parsed)) || a.ref.localeCompare(b.ref))
    .map(({ parsed: _parsed, ...row }) => row);
}

export interface Passage {
  label: string;
  book: string;
  volume: Volume | null;
  refs: string[];
  citations: { talk: string; finding: string; spoken: boolean }[];
  talks: string[];
}

function compact(verses: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < verses.length; i++) {
    let j = i;
    while (j + 1 < verses.length && verses[j + 1] === verses[j] + 1) j++;
    out.push(i === j ? `${verses[i]}` : `${verses[i]}–${verses[j]}`);
    i = j;
  }
  return out.join(', ');
}

function labelOf(book: string, spans: Span[]): string {
  const chapters = [...new Set(spans.map((s) => s.chapter))].sort((a, b) => a - b);
  if (spans.some((s) => s.verses === null)) {
    const [first, last] = [chapters[0], chapters.at(-1)];
    return first === last ? `${book} ${first}` : `${book} ${first}–${last}`;
  }
  const byChapter = chapters.map((c) => {
    const verses = [...new Set(spans.filter((s) => s.chapter === c).flatMap((s) => s.verses!))].sort((a, b) => a - b);
    return `${c}:${compact(verses)}`;
  });
  return `${book} ${byChapter.join('; ')}`;
}

// One passage per group of references that share a verse (directly or through another reference).
// A one-chapter citation pulls in every verse cited inside that chapter. A citation of several
// chapters (3 Nephi 11–28) points at a whole section, so it stays apart from the verses inside it.
export function groupPassages(rows: ScriptureRow[]): Passage[] {
  const parent = new Map(rows.map((r) => [r.ref, r.ref]));
  const root = (x: string): string => (parent.get(x) === x ? x : root(parent.get(x)!));
  const section = (ref: string) => parseRef(ref).spans.length > 1 && parseRef(ref).spans.every((s) => s.verses === null);
  for (const r of rows) {
    if (section(r.ref)) continue;
    for (const o of r.overlaps) if (!section(o)) parent.set(root(o), root(r.ref));
  }

  const groups = new Map<string, ScriptureRow[]>();
  for (const r of rows) groups.set(root(r.ref), [...(groups.get(root(r.ref)) ?? []), r]);

  const passages = [...groups.values()].map((members) => {
    const parsed = members.map((m) => parseRef(m.ref));
    const spans = parsed.flatMap((p) => p.spans);
    const label = spans.length === 0 ? members[0].ref : labelOf(parsed[0].book, spans);
    const citations = members.flatMap((m) => m.citations);
    const keys = parsed.map(sortKey).sort(compareKeys);
    return {
      key: keys[0],
      passage: {
        label,
        book: parsed[0].book,
        volume: parsed[0].volume,
        refs: members.map((m) => m.ref),
        citations,
        talks: [...new Set(citations.map((c) => c.talk))].sort(),
      },
    };
  });
  return passages.sort((a, b) => compareKeys(a.key, b.key) || a.passage.label.localeCompare(b.passage.label)).map((p) => p.passage);
}

function compareKeys(a: number[], b: number[]): number {
  return a.reduce((acc, x, i) => acc || x - b[i], 0);
}
