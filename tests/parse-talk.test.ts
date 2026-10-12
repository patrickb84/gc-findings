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

  it('completes a footnote reference that continues the previous book', () => {
    const q = parseTalk({
      content: {
        body: '<div class="body-block"><p>x</p></div>',
        footnotes: {
          n1: { marker: '1.', text: '<p>See Doctrine and Covenants 76:53; 132:7, 18–19.</p>', referenceUris: [
            { type: 'scripture-ref', href: '/study/scriptures/dc-testament/dc/76?id=p53', text: 'Doctrine and Covenants 76:53' },
            { type: 'scripture-ref', href: '/study/scriptures/dc-testament/dc/132?id=p7', text: '132:7, 18–19' },
          ] },
        },
      },
    });
    expect(q.citations.map((c) => [c.ref, c.text])).toEqual([
      ['Doctrine and Covenants 76:53', 'Doctrine and Covenants 76:53'],
      ['Doctrine and Covenants 132:7, 18–19', '132:7, 18–19'],
    ]);
  });

  it('completes "see also verse 12" from the previous book and chapter', () => {
    const q = parseTalk({
      content: {
        body: '<div class="body-block"><p>x</p></div>',
        footnotes: {
          n1: { marker: '1.', text: '<p>Alma 7:11; see also verse 12.</p>', referenceUris: [
            { type: 'scripture-ref', href: '/study/scriptures/bofm/alma/7?id=p11', text: 'Alma 7:11' },
            { type: 'scripture-ref', href: '/study/scriptures/bofm/alma/7?id=p12', text: 'verse 12' },
          ] },
          n2: { marker: '2.', text: '<p>Mosiah 24:8; verses 13–15.</p>', referenceUris: [
            { type: 'scripture-ref', href: '/study/scriptures/bofm/mosiah/24?id=p8', text: 'Mosiah 24:8' },
            { type: 'scripture-ref', href: '/study/scriptures/bofm/mosiah/24?id=p13-p15', text: 'verses 13–15' },
          ] },
          n3: { marker: '3.', text: '<p>See 2 Nephi 28, especially verses 7–9 and 24–32.</p>', referenceUris: [
            { type: 'scripture-ref', href: '/study/scriptures/bofm/2-ne/28?lang=eng', text: '2 Nephi 28' },
            { type: 'scripture-ref', href: '/study/scriptures/bofm/2-ne/28?lang=eng&amp;id=p7-p9#p7', text: '7–9' },
            { type: 'scripture-ref', href: '/study/scriptures/bofm/2-ne/28?lang=eng&amp;id=p24-p32#p24', text: '24–32' },
          ] },
        },
      },
    });
    expect(q.citations.map((c) => [c.ref, c.text])).toEqual([
      ['Alma 7:11', 'Alma 7:11'],
      ['Alma 7:12', 'verse 12'],
      ['Mosiah 24:8', 'Mosiah 24:8'],
      ['Mosiah 24:13–15', 'verses 13–15'],
      ['2 Nephi 28', '2 Nephi 28'],
      ['2 Nephi 28:7–9', '7–9'],
      ['2 Nephi 28:24–32', '24–32'],
    ]);
  });

  it('decodes entities in footnote link text ("D&amp;C 1:35")', () => {
    const q = parseTalk({
      content: {
        body: '<div class="body-block"><p>x</p></div>',
        footnotes: {
          n1: { marker: '1.', text: '<p>(D&amp;C 1:35)</p>', referenceUris: [
            { type: 'scripture-ref', href: '/study/scriptures/dc-testament/dc/1?lang=eng&amp;id=p35#p35', text: 'D&amp;C 1:35' },
          ] },
        },
      },
    });
    expect(q.notes[0].refs[0].text).toBe('D&C 1:35');
    expect(q.citations.map((c) => [c.ref, c.text])).toEqual([['D&C 1:35', 'D&C 1:35']]);
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
