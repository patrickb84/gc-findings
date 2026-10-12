import * as cheerio from 'cheerio';
import type { ManifestEntry } from './types.ts';

const NOT_TALKS = /^(Sustaining of|Church Auditing Department Report)/;

export function parseManifest(bodyHtml: string): ManifestEntry[] {
  const $ = cheerio.load(bodyHtml);
  const out: ManifestEntry[] = [];
  let session = '';
  $('a.list-tile').each((_, a) => {
    const uri = ($(a).attr('href') ?? '').replace(/^\/study/, '').replace(/\?.*$/, '');
    const slug = uri.split('/').pop() ?? '';
    const title = $(a).find('p.title').first().text().trim();
    if (slug.endsWith('-session')) {
      session = title;
      return;
    }
    if (NOT_TALKS.test(title)) return;
    const speaker = $(a).find('p.primaryMeta').first().text().trim();
    out.push({ slug, uri, speaker, title, session, order: out.length + 1 });
  });
  return out;
}
