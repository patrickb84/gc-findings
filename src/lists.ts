import { normalize, quoteInText } from './quotes.ts';
import type { TalkFile } from './types.ts';

// The Lists page: every list highlight, with the principle it serves and each item explained and quoted.
export interface ListItem { thing: string; description: string; quote: string }
export interface TalkList { finding: string; principle: string; items: ListItem[]; skip?: string }
export interface TalkLists { brief: string; lists: TalkList[] }
export type ListsFile = Record<string, TalkLists>;

export function checkLists(file: ListsFile, talks: Record<string, TalkFile>, corpora: Record<string, string>): string[] {
  const errors: string[] = [];
  for (const [slug, entry] of Object.entries(file)) {
    const talk = talks[slug];
    if (!talk) { errors.push(`${slug}: no such talk`); continue; }
    if (!entry.brief?.trim()) errors.push(`${slug}: empty brief`);
    for (const l of entry.lists) {
      const where = `${slug}/${l.finding}`;
      const f = talk.findings.find((x) => x.id === l.finding);
      if (!f) { errors.push(`${where}: no such finding`); continue; }
      if (f.type !== 'list') errors.push(`${where}: not a list finding`);
      if (l.skip?.trim()) continue;
      if (!l.principle?.trim()) errors.push(`${where}: empty principle`);
      if (l.items.length < 2) errors.push(`${where}: fewer than two items`);
      l.items.forEach((it, i) => {
        if (!it.thing?.trim() || !it.description?.trim()) errors.push(`${where} item ${i + 1}: empty thing or description`);
        if (!quoteInText(it.quote ?? '', corpora[slug] ?? '')) errors.push(`${where} item ${i + 1}: quote not found in talk`);
      });
    }
  }
  for (const [slug, talk] of Object.entries(talks)) {
    for (const f of talk.findings) {
      if (f.type === 'list' && file[slug] && !file[slug].lists.some((l) => l.finding === f.id)) errors.push(`${slug}/${f.id}: list has no entry`);
    }
  }
  return errors;
}

export function honorific(role: string): string {
  if (/First Presidency|^President of The Church|^Acting President|Young Men General President/.test(role)) return 'President';
  if (/Presiding Bishopric/.test(role)) return 'Bishop';
  if (/Young Women|Primary|Relief Society/.test(role)) return 'Sister';
  if (/Sunday School/.test(role)) return 'Brother';
  if (/Seventy|Quorum of the Twelve/.test(role)) return 'Elder';
  return '';
}

// "You are useless." under the title **You are useless** adds nothing, so the quote line is dropped.
function repeatsTitle(it: ListItem): boolean {
  const bare = (s: string) => normalize(s).replace(/[.,;:!?"']/g, '').replace(/^and /, '').trim();
  return bare(it.quote) === bare(it.thing);
}

// Each talk's lists get their own page under Lists, named title first, then speaker.
export function listPageTitle(talk: TalkFile): string {
  return `${talk.title} — ${[honorific(talk.role), talk.speaker].filter(Boolean).join(' ')}`;
}

export function renderTalkLists(talk: TalkFile, entry: TalkLists, talkPage: string): string {
  const lines = [
    `<mention-page url="${talkPage}"/> · [Read the talk](${talk.url})`,
    entry.brief,
  ];
  for (const l of entry.lists.filter((x) => !x.skip)) {
    lines.push(`**Principle:** ${l.principle}`);
    l.items.forEach((it, i) => {
      lines.push(`${i + 1}. **${it.thing}**`, `\t${it.description}`);
      if (!repeatsTitle(it)) lines.push(`\t> “${it.quote}”`);
    });
  }
  return lines.join('\n');
}
