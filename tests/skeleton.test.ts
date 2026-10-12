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
