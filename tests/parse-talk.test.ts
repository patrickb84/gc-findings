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
