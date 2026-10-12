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
  'first article of faith': { book: 'Articles of Faith', volume: 'Pearl of Great Price', spans: [{ chapter: 1, verses: [1] }] },
  'title page of the book of mormon': { book: 'Title Page', volume: 'Book of Mormon', spans: [] },
};

function volumeOf(book: string): Volume | null {
  return VOLUME_ORDER.find((v) => (VOLUMES[v] as readonly string[]).includes(book)) ?? null;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

function numbers(list: string): number[] {
  return list.split(',').flatMap((part) => {
    const [from, to] = part.trim().split(/[–-]/).map(Number);
    return to === undefined ? [from] : range(from, to);
  });
}

export function parseRef(ref: string): ParsedRef {
  // Church text writes "2 Nephi" with a non-breaking space; \s matches it.
  const clean = ref.replace(/\s+/g, ' ').trim();
  const spoken = SPOKEN_FORMS[clean.toLowerCase()];
  if (spoken) return spoken;
  const said = clean.match(/^(.+?) chapter (\d+)$/i);
  if (said) return { book: said[1], volume: volumeOf(said[1]), spans: [{ chapter: Number(said[2]), verses: null }] };
  const m = clean.match(/^(.+?) (\d+)(?:[–-](\d+))?(?::(.+))?$/);
  if (!m) return { book: clean, volume: volumeOf(clean), spans: [] };
  const [, book, first, last, verses] = m;
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
  const compare = (a: number[], b: number[]) => a.reduce((acc, x, i) => acc || x - b[i], 0);
  return rows
    .sort((a, b) => compare(sortKey(a.parsed), sortKey(b.parsed)) || a.ref.localeCompare(b.ref))
    .map(({ parsed: _parsed, ...row }) => row);
}
