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

  it('does not count the book name Doctrine and Covenants as covenants', () => {
    const r = countFamily(['covenant', 'covenants'], {
      hymn: ['Doctrine and Covenants 76:22–24, 41–42'],
      talk: ['We keep our covenants, as Doctrine and Covenants 20 teaches.'],
    });
    expect(r).toEqual({ mentions: 1, talks: ['talk'] });
  });

  it('skips the phrases a family excludes', () => {
    const r = countFamily(['light'], {
      schmeil: ['For my yoke is easy, and my burden is light.'],
      hymn: ['The light beyond the veil of death.'],
    }, ['burden is light']);
    expect(r).toEqual({ mentions: 1, talks: ['hymn'] });
  });
});

describe('countTerms and book names', () => {
  it('does not count covenants inside Doctrine and Covenants', () => {
    expect(countTerms(['Doctrine and Covenants 76:22'])['covenants']).toBeUndefined();
  });
});
