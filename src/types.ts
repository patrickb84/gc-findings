export const FINDING_TYPES = [
  'invitation', 'promise', 'list',
  'testimony', 'revelation',
  'scripture', 'prophet', 'past_prophet', 'christ', 'source',
  'story', 'relationship',
  'image', 'place', 'name_of_christ',
] as const;
export type FindingType = (typeof FINDING_TYPES)[number];

export const ARC_BEATS = ['story', 'principle', 'scripture', 'quote', 'list', 'invitation', 'promise', 'testimony'] as const;
export type ArcBeat = (typeof ARC_BEATS)[number];

export interface Finding {
  id: string;
  type: FindingType;
  quote: string;
  basis: 'exact' | 'interpreted';
  note?: string;
  ref?: string;
  spoken?: boolean;
  paired_with?: string;
  detail?: Record<string, string | string[]>;
  terms?: string[];
}

export interface ManifestEntry {
  slug: string;
  uri: string;
  speaker: string;
  title: string;
  session: string;
  order: number;
}

export interface Citation { ref: string; text: string; href: string; inText: boolean }
export interface NoteRef { type: string; text: string; href: string }
export interface Note { marker: string; text: string; refs: NoteRef[] }

export interface ParsedTalk {
  speaker: string;
  role: string;
  title: string;
  paragraphs: string[];
  citations: Citation[];
  notes: Note[];
}

export interface TalkFile {
  id: string;
  kind: 'talk' | 'hymn';
  speaker: string;
  role: string;
  title: string;
  session: string;
  order: number;
  url: string;
  summary: string;
  audience: { who: string; quote?: string } | null;
  arc: ArcBeat[];
  orientation: { past: number; present: number; future: number } | null;
  pronouns: { i: number; we: number; you: number };
  findings: Finding[];
}

export type TermCounts = Record<string, number>;

export interface IndexEntry {
  term: string;
  kind: 'keyword' | 'subject' | 'image';
  variants: string[];
  exclude?: string[];
  mentions: number | null;
  talks: string[];
  status: 'discovered' | 'proposed_family' | 'approved' | 'rejected';
}

export interface Discovery {
  title: string;
  body: string;
  evidence: { talk: string; finding: string }[];
}

export interface RawFootnote {
  marker: string;
  text: string;
  referenceUris?: { type: string; href: string; text: string }[];
}
export interface RawContent { content: { body: string; footnotes?: Record<string, RawFootnote> } }
