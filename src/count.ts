import { STOPWORDS } from './stopwords.ts';
import type { IndexEntry, TermCounts } from './types.ts';

export function tokenize(text: string): string[] {
  return (text.toLowerCase().replace(/[‘’]/g, "'").match(/[\p{L}']+/gu) ?? [])
    .map((t) => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

// Book names that contain a counted word (Covenants) are not mentions of it.
const BOOK_NAMES = /doctrine\s+and\s+covenants/giu;
const maskBookNames = (text: string) => text.replace(BOOK_NAMES, ' ');

export function countTerms(paragraphs: string[], maxN = 3): TermCounts {
  const counts: TermCounts = {};
  for (const p of paragraphs) {
    const toks = tokenize(maskBookNames(p));
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
    const text = maskBookNames(paragraphs.join('\n')).toLowerCase().replace(/[‘’]/g, "'");
    const n = text.match(re)?.length ?? 0;
    if (n > 0) {
      mentions += n;
      talks.push(talk);
    }
  }
  return { mentions, talks: talks.sort() };
}
