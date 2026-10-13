import { describe, expect, it } from 'vitest';
import { checkLists, honorific, renderTalkLists, type ListsFile } from '../src/lists.ts';
import type { Finding, TalkFile } from '../src/types.ts';

const list = (id: string, items: string[]): Finding => ({
  id, type: 'list', quote: 'x', basis: 'exact', detail: { count: String(items.length), items, purpose: 'p' },
});
const talk = (findings: Finding[]): TalkFile => ({
  id: 'a', kind: 'talk', speaker: 'Gerrit W. Gong', role: 'Of the Quorum of the Twelve Apostles', title: 'Covenant Belonging', session: 'Saturday Morning Session',
  order: 1, url: 'https://example.org/a', summary: '', audience: null, arc: [], orientation: null, pronouns: { i: 0, we: 0, you: 0 }, findings,
});
const corpus = 'First, a temple dedication is a beginning. Fourth, temple service includes a spirit of gratitude.';
const good: ListsFile = {
  a: {
    brief: 'Elder Gong teaches about temples.',
    lists: [{
      finding: 'c-1',
      principle: 'Bring a temple culture of your own.',
      items: [
        { thing: 'A dedication is a beginning', description: 'The blessings start when we come.', quote: 'a temple dedication is a beginning' },
        { thing: 'Gratitude', description: 'The temple is a privilege.', quote: 'temple service includes a spirit of gratitude' },
      ],
    }],
  },
};

describe('checkLists', () => {
  const talks = { a: talk([list('c-1', ['one', 'two'])]) };

  it('accepts lists whose quotes are in the talk', () => {
    expect(checkLists(good, talks, { a: corpus })).toEqual([]);
  });

  it('rejects an item quote that is not in the talk', () => {
    const bad = structuredClone(good);
    bad.a.lists[0].items[1].quote = 'a spirit of entitlement';
    expect(checkLists(bad, talks, { a: corpus })).toEqual(['a/c-1 item 2: quote not found in talk']);
  });

  it('reports a list finding that has no entry', () => {
    const more = { a: talk([list('c-1', ['one', 'two']), list('c-2', ['three', 'four'])]) };
    expect(checkLists(good, more, { a: corpus })).toEqual(['a/c-2: list has no entry']);
  });

  it('rejects an entry that points at a finding which is not a list', () => {
    const notList = { a: talk([{ ...list('c-1', ['one', 'two']), type: 'story' }]) };
    expect(checkLists(good, notList, { a: corpus })).toContain('a/c-1: not a list finding');
  });

  it('accepts a skipped list with a reason and no items', () => {
    const skipped: ListsFile = { a: { brief: 'b', lists: [{ finding: 'c-1', principle: '', items: [], skip: 'a pair of words, not a list' }] } };
    expect(checkLists(skipped, talks, { a: corpus })).toEqual([]);
  });
});

describe('honorific', () => {
  it('gives the title each calling carries', () => {
    expect(honorific('Of the Seventy')).toBe('Elder');
    expect(honorific('Of the Quorum of the Twelve Apostles')).toBe('Elder');
    expect(honorific('First Counselor in the First Presidency')).toBe('President');
    expect(honorific('Acting President of the Quorum of the Twelve Apostles')).toBe('President');
    expect(honorific('President of The Church of Jesus Christ of Latter-day Saints')).toBe('President');
    expect(honorific('Young Men General President')).toBe('President');
    expect(honorific('Second Counselor in the Presiding Bishopric')).toBe('Bishop');
    expect(honorific('Primary General President')).toBe('Sister');
    expect(honorific('Second Counselor in the Young Women General Presidency')).toBe('Sister');
    expect(honorific('Second Counselor in the Sunday School General Presidency')).toBe('Brother');
  });
});

describe('renderTalkLists', () => {
  it('writes the talk heading, links, brief, principle and numbered items with their quotes', () => {
    const md = renderTalkLists(talk([]), good.a, 'https://app.notion.com/p/abc');
    expect(md).toBe([
      '### Elder Gerrit W. Gong: Covenant Belonging',
      '<mention-page url="https://app.notion.com/p/abc"/> · [Read the talk](https://example.org/a)',
      'Elder Gong teaches about temples.',
      '**Principle**',
      'Bring a temple culture of your own.',
      '1. **A dedication is a beginning**',
      '\tThe blessings start when we come.',
      '\t> “a temple dedication is a beginning”',
      '2. **Gratitude**',
      '\tThe temple is a privilege.',
      '\t> “temple service includes a spirit of gratitude”',
    ].join('\n'));
  });

  it('leaves out a quote that only repeats the item title', () => {
    const echo = { brief: 'b', lists: [{ finding: 'c-1', principle: 'p', items: [
      { thing: 'You are useless', description: 'Words that wound.', quote: 'You are useless.' },
      { thing: 'Simon Peter', description: 'A fisherman.', quote: 'and Simon Peter' },
      { thing: 'Seeing', description: 'Noticing someone.', quote: 'Seeing awakened compassion.' },
    ] }] };
    const md = renderTalkLists(talk([]), echo, 'u');
    expect(md).not.toContain('“You are useless.”');
    expect(md).not.toContain('“and Simon Peter”');
    expect(md).toContain('\t> “Seeing awakened compassion.”');
  });

  it('leaves skipped lists out', () => {
    const md = renderTalkLists(talk([]), { brief: 'b', lists: [{ finding: 'c-1', principle: '', items: [], skip: 'pair' }] }, 'u');
    expect(md).not.toContain('**Principle**');
  });
});
