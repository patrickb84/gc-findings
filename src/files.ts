import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ManifestEntry, RawContent } from './types.ts';

export interface Manifest {
  conference: string;
  entries: ManifestEntry[];
  pilot: string[];
  hymn: { slug: string; uri: string; title: string } | null;
}

export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw e;
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2) + '\n');
}

export const API = 'https://www.churchofjesuschrist.org/study/api/v3/language-pages/type/content?lang=eng&uri=';

export async function fetchContent(uri: string): Promise<RawContent> {
  const res = await fetch(API + uri, { headers: { 'user-agent': 'gc-findings personal study project' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${uri}`);
  return (await res.json()) as RawContent;
}

export async function loadRaw(slug: string): Promise<RawContent> {
  const raw = await readJson<RawContent | null>(`data/raw/${slug}.json`, null);
  if (!raw) throw new Error(`data/raw/${slug}.json missing - run pnpm fetch-talks first`);
  return raw;
}
