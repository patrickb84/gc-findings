import * as cheerio from 'cheerio';
import type { Citation, Note, ParsedTalk, RawContent } from './types.ts';

const SCRIPTURE_PATH = /^\/study\/scriptures\/(ot|nt|bofm|dc-testament|pgp)\//;
const CHAPTER_ONLY = /^\d+:\d/;
// "see also verse 12" or "verses 7–9 and 24–32": no book, so the book comes from the previous
// reference and the chapter from the link.
const VERSES_ONLY = /^(?:verses?\s+)?(\d+(?:\s*[-‒–]\s*\d+)?(?:,\s*\d+(?:\s*[-‒–]\s*\d+)?)*)$/i;
const LINK_CHAPTER = /\/(\d+)\?[^#]*\bid=p\d/;
const TITLES =/^(President|Elder|Sister|Brother|Bishop)\s+/;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export function parseTalk(raw: RawContent): ParsedTalk {
  const $ = cheerio.load(raw.content.body);
  $('a.note-ref').remove();

  const speaker = clean($('p.author-name').first().text()).replace(/^By\s+/, '').replace(TITLES, '');
  const role = clean($('p.author-role').first().text());
  const title = clean($('h1').first().text());

  const paragraphs = $('div.body-block')
    .find('p, li')
    .toArray()
    .filter((el) => $(el).find('p, li').length === 0)
    .map((el) => clean($(el).text()))
    .filter(Boolean);

  const citations: Citation[] = [];
  const seen = new Set<string>();
  let lastRef = '';
  const complete = (text: string, href: string) => {
    const verses = text.match(VERSES_ONLY);
    const chapter = href.match(LINK_CHAPTER);
    const book = lastRef.replace(/\s+\d+(?:[-‒–]\d+)?(?::.*)?$/, '');
    const ref = verses && chapter && lastRef ? `${book} ${chapter[1]}:${verses[1]}`
      : CHAPTER_ONLY.test(text) && lastRef ? `${lastRef.replace(/\s+\d+:.*$/, '')} ${text}` : text;
    lastRef = ref;
    return ref;
  };

  $('div.body-block a.scripture-ref').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (!SCRIPTURE_PATH.test(href)) return;
    const text = clean($(a).text());
    const ref = complete(text, href);
    citations.push({ ref, text, href, inText: true });
    seen.add(ref);
  });

  const notes: Note[] = Object.values(raw.content.footnotes ?? {}).map((f) => ({
    marker: f.marker,
    text: clean(cheerio.load(f.text).text()),
    refs: (f.referenceUris ?? []).map((r) => ({ type: r.type, href: r.href.replace(/&amp;/g, '&'), text: r.text })),
  }));

  for (const n of notes) {
    for (const r of n.refs) {
      if (r.type !== 'scripture-ref' || !SCRIPTURE_PATH.test(r.href)) continue;
      const ref = complete(r.text, r.href);
      if (seen.has(ref)) continue;
      citations.push({ ref, text: r.text, href: r.href, inText: false });
      seen.add(ref);
    }
  }

  return { speaker, role, title, paragraphs, citations, notes };
}

export function corpusOf(parsed: ParsedTalk): string {
  return [...parsed.paragraphs, ...parsed.notes.map((n) => n.text)].join('\n');
}
