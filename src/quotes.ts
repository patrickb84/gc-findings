import { ARC_BEATS, FINDING_TYPES } from './types.ts';
import type { Discovery, Finding, TalkFile } from './types.ts';

export function normalize(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
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
    if (!d.section?.trim()) errors.push(`"${d.title}": no section`);
    for (const e of d.evidence) {
      if (!talks[e.talk]?.findings.some((f) => f.id === e.finding)) errors.push(`"${d.title}": no finding ${e.talk}/${e.finding}`);
    }
  }
  return errors;
}
