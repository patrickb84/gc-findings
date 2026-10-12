import { describe, expect, it } from 'vitest';
import { buildScriptureTable, groupPassages, overlaps, parseRef } from '../src/scriptures.ts';
import type { Finding, TalkFile } from '../src/types.ts';

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('parseRef', () => {
  it('reads verse ranges and lists in one chapter', () => {
    expect(parseRef('Doctrine and Covenants 76:22–24, 41–42')).toEqual({
      book: 'Doctrine and Covenants', volume: 'Doctrine and Covenants',
      spans: [{ chapter: 76, verses: [22, 23, 24, 41, 42] }],
    });
  });

  it('reads a chapter range as whole chapters', () => {
    const r = parseRef('3 Nephi 11–28');
    expect(r.book).toBe('3 Nephi');
    expect(r.volume).toBe('Book of Mormon');
    expect(r.spans).toHaveLength(18);
    expect(r.spans[0]).toEqual({ chapter: 11, verses: null });
  });

  it('knows the volume of numbered books and the Pearl of Great Price', () => {
    expect(parseRef('1 John 4:19').volume).toBe('New Testament');
    expect(parseRef('Moses 6:52, 59')).toEqual({ book: 'Moses', volume: 'Pearl of Great Price', spans: [{ chapter: 6, verses: [52, 59] }] });
    expect(parseRef('Haggai 1:5–7, 9').spans).toEqual([{ chapter: 1, verses: [5, 6, 7, 9] }]);
  });

  it('reads a numbered book written with a non-breaking space', () => {
    expect(parseRef('2 Nephi 9:5')).toEqual({ book: '2 Nephi', volume: 'Book of Mormon', spans: [{ chapter: 9, verses: [5] }] });
  });

  it('reads a range written with a figure dash', () => {
    expect(parseRef('Matthew 25:14‒30').spans).toEqual([{ chapter: 25, verses: range(14, 30) }]);
    expect(parseRef('Doctrine and Covenants 100:5‒8, 10').spans).toEqual([{ chapter: 100, verses: [5, 6, 7, 8, 10] }]);
  });

  it('reads "Psalm" as the book of Psalms', () => {
    expect(parseRef('Psalm 55:22')).toEqual({ book: 'Psalms', volume: 'Old Testament', spans: [{ chapter: 55, verses: [22] }] });
  });

  it('reads a spoken "<book> chapter <n>" as the whole chapter', () => {
    expect(parseRef('Isaiah chapter 58')).toEqual({ book: 'Isaiah', volume: 'Old Testament', spans: [{ chapter: 58, verses: null }] });
  });

  it('names the spoken forms', () => {
    expect(parseRef('first article of faith')).toEqual({ book: 'Articles of Faith', volume: 'Pearl of Great Price', spans: [{ chapter: 1, verses: [1] }] });
    expect(parseRef('Title page of the Book of Mormon')).toEqual({ book: 'Title Page', volume: 'Book of Mormon', spans: [] });
  });
});

describe('overlaps', () => {
  it('finds a shared verse inside two ranges', () => {
    expect(overlaps(parseRef('Doctrine and Covenants 76:39–43'), parseRef('Doctrine and Covenants 76:22–24, 41–42'))).toBe(true);
  });

  it('does not count next-door verses', () => {
    expect(overlaps(parseRef('Alma 34:32'), parseRef('Alma 34:33'))).toBe(false);
  });

  it('counts a verse inside a whole-chapter citation', () => {
    expect(overlaps(parseRef('3 Nephi 11–28'), parseRef('3 Nephi 16:1'))).toBe(true);
  });

  it('never matches across books', () => {
    expect(overlaps(parseRef('John 8:11'), parseRef('1 John 4:19'))).toBe(false);
  });
});

const scripture = (id: string, ref: string, spoken: boolean): Finding => ({ id, type: 'scripture', quote: ref, basis: 'exact', ref, spoken });
const talk = (id: string, findings: Finding[]): TalkFile => ({
  id, kind: 'talk', speaker: '', role: '', title: id, session: '', order: 1, url: '',
  summary: '', audience: null, arc: [], orientation: null, pronouns: { i: 0, we: 0, you: 0 }, findings,
});

describe('buildScriptureTable', () => {
  const talks = [
    talk('a', [scripture('x-s1', 'Haggai 2:19', true), scripture('x-s2', 'Haggai 2:19', true), scripture('x-s3', 'Doctrine and Covenants 76:39–43', false)]),
    talk('b', [scripture('x-s1', 'Doctrine and Covenants 76:22–24, 41–42', true), scripture('x-s2', 'Alma 34:32', false)]),
  ];
  const rows = buildScriptureTable(talks);

  it('has one row per reference, with every citation of it', () => {
    expect(rows).toHaveLength(4);
    const haggai = rows.find((r) => r.ref === 'Haggai 2:19');
    expect(haggai?.citations).toEqual([{ talk: 'a', finding: 'x-s1', spoken: true }, { talk: 'a', finding: 'x-s2', spoken: true }]);
    expect(haggai?.talks).toEqual(['a']);
    expect(haggai?.spoken).toBe(true);
  });

  it('lists the references that share a verse with it, from other rows', () => {
    const dc = rows.find((r) => r.ref === 'Doctrine and Covenants 76:39–43');
    expect(dc?.overlaps).toEqual(['Doctrine and Covenants 76:22–24, 41–42']);
    expect(rows.find((r) => r.ref === 'Alma 34:32')?.overlaps).toEqual([]);
  });

  it('orders rows by volume, then book, then chapter', () => {
    expect(rows.map((r) => r.ref)).toEqual(['Haggai 2:19', 'Alma 34:32', 'Doctrine and Covenants 76:22–24, 41–42', 'Doctrine and Covenants 76:39–43']);
  });
});

describe('groupPassages', () => {
  const talks = [
    talk('a', [scripture('x-s1', 'Alma 7:11', false), scripture('x-s2', 'Alma 7:11–12', false), scripture('x-s3', 'Mosiah 24:8–16', false), scripture('x-s4', 'Mosiah 24:10', false)]),
    talk('b', [scripture('x-s1', 'Alma 7:11, 12', false), scripture('x-s2', 'Alma 7:13', false)]),
    talk('c', [scripture('x-s1', '3 Nephi 11–28', false), scripture('x-s2', 'verse 12', false)]),
    talk('d', [scripture('x-s1', '3 Nephi 18:11', true)]),
  ];
  const passages = groupPassages(buildScriptureTable(talks));
  const find = (label: string) => passages.find((p) => p.label === label);

  it('merges references that share a verse, across and within talks', () => {
    expect(find('Alma 7:11–12')).toMatchObject({ book: 'Alma', volume: 'Book of Mormon', talks: ['a', 'b'] });
    expect([...find('Alma 7:11–12')!.refs].sort()).toEqual(['Alma 7:11', 'Alma 7:11, 12', 'Alma 7:11–12'].sort());
    expect(find('Alma 7:11–12')?.citations).toHaveLength(3);
    expect(find('Mosiah 24:8–16')?.refs).toEqual(['Mosiah 24:8–16', 'Mosiah 24:10']);
  });

  it('keeps next-door verses apart', () => {
    expect(find('Alma 7:13')?.citations).toHaveLength(1);
  });

  it('keeps a citation of several chapters apart from the verses inside it', () => {
    expect(find('3 Nephi 11–28')).toMatchObject({ refs: ['3 Nephi 11–28'], talks: ['c'] });
    expect(find('3 Nephi 18:11')).toMatchObject({ refs: ['3 Nephi 18:11'], talks: ['d'] });
  });

  it('labels a one-chapter citation by its chapter and pulls in the verses inside it', () => {
    const one = groupPassages(buildScriptureTable([
      talk('e', [scripture('x-s1', 'Isaiah chapter 58', true)]),
      talk('f', [scripture('x-s1', 'Isaiah 58:6', false)]),
    ]));
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ label: 'Isaiah 58', talks: ['e', 'f'] });
  });

  it('keeps a reference it cannot read as its own passage', () => {
    expect(find('verse 12')).toMatchObject({ volume: null, talks: ['c'] });
  });

  it('puts passages in canon order', () => {
    expect(passages.map((p) => p.label)).toEqual(['Mosiah 24:8–16', 'Alma 7:11–12', 'Alma 7:13', '3 Nephi 11–28', '3 Nephi 18:11', 'verse 12']);
  });
});
