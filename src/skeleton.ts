import { countFamily } from './count.ts';
import type { Finding, IndexEntry, ParsedTalk, TalkFile } from './types.ts';

export type SkeletonBase = Omit<TalkFile, 'findings' | 'summary' | 'audience' | 'arc' | 'orientation'>;

export function exactFindings(parsed: ParsedTalk): Finding[] {
  const out: Finding[] = parsed.citations.map((c, i): Finding => ({
    id: `x-s${i + 1}`, type: 'scripture', quote: c.ref, basis: 'exact', ref: c.ref, spoken: c.inText,
  }));
  for (const n of parsed.notes) {
    const cross = n.refs.find((r) => r.type === 'cross-ref');
    if (cross) out.push({ id: `x-n${n.marker.replace(/\D/g, '')}`, type: 'source', quote: n.text, basis: 'exact', ref: cross.text });
  }
  return out;
}

export function mergeSkeleton(existing: TalkFile | null, base: SkeletonBase, exact: Finding[]): TalkFile {
  const prior = new Map((existing?.findings ?? []).map((f) => [f.id, f]));
  const code = exact.map((f) => {
    const p = prior.get(f.id);
    if (!p) return f;
    const kept: Partial<Finding> = { type: p.type };
    if (p.note !== undefined) kept.note = p.note;
    if (p.detail !== undefined) kept.detail = p.detail;
    if (p.terms !== undefined) kept.terms = p.terms;
    return { ...f, ...kept };
  });
  const claude = (existing?.findings ?? []).filter((f) => !f.id.startsWith('x-'));
  return {
    ...base,
    summary: existing?.summary ?? '',
    audience: existing?.audience ?? null,
    arc: existing?.arc ?? [],
    orientation: existing?.orientation ?? null,
    findings: [...code, ...claude],
  };
}

export function mergeIndex(existing: IndexEntry[], discovered: IndexEntry[], paragraphsByTalk: Record<string, string[]>): IndexEntry[] {
  const curated = existing
    .filter((e) => e.status !== 'discovered')
    .map((e) => (e.kind === 'subject' || e.variants.length === 0 ? e : { ...e, ...countFamily(e.variants, paragraphsByTalk) }));
  const absorbed = new Set(curated.flatMap((e) => e.variants.map((v) => v.toLowerCase())));
  return [...curated, ...discovered.filter((d) => !absorbed.has(d.term))];
}
