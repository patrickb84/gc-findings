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
