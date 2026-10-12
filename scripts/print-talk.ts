import { loadRaw } from '../src/files.ts';
import { parseTalk } from '../src/parse-talk.ts';

const slug = process.argv[2];
if (!slug) throw new Error('usage: node scripts/print-talk.ts <slug>');
const p = parseTalk(await loadRaw(slug));
console.log(`${p.title}\n${p.speaker} - ${p.role}\n`);
console.log(p.paragraphs.join('\n\n'));
console.log('\nNOTES');
for (const n of p.notes) console.log(`${n.marker} ${n.text}`);
