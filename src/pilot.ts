export const PROPHET_ROLE = 'President of The Church of Jesus Christ of Latter-day Saints';

export interface PilotCandidate { slug: string; speaker: string; role: string; order: number }

export function fold(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function selectPilot(talks: PilotCandidate[], requestedSpeakers: string[]): string[] {
  const sorted = [...talks].sort((a, b) => a.order - b.order);
  const isProphet = (x: PilotCandidate) => x.role === PROPHET_ROLE;
  const picked = new Set<string>();

  const first = sorted[0];
  const last = sorted.at(-1);
  if (first) picked.add(first.slug);
  if (last) {
    picked.add(last.slug);
    const secondToLast = sorted.at(-2);
    if (isProphet(last) && secondToLast) picked.add(secondToLast.slug);
  }
  for (const x of sorted) if (isProphet(x)) picked.add(x.slug);

  for (const name of requestedSpeakers) {
    const matches = sorted.filter((x) => fold(x.speaker).includes(fold(name)));
    if (matches.length === 0) throw new Error(`No talk by "${name}"`);
    for (const m of matches) picked.add(m.slug);
  }

  return sorted.filter((x) => picked.has(x.slug)).map((x) => x.slug);
}
