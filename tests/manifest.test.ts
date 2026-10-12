import { describe, expect, it } from 'vitest';
import { parseManifest } from '../src/manifest.ts';

const tile = (slug: string, speaker: string, title: string) =>
  `<li><a href="/study/general-conference/2026/10/${slug}?lang=eng" class="list-tile"><p class="primaryMeta">${speaker}</p><p class="title">${title}</p><p class="description">d</p></a></li>`;
const session = (slug: string, title: string) =>
  `<li><a href="/study/general-conference/2026/10/${slug}?lang=eng" class="list-tile"><p class="title">${title}</p></a></li>`;

const html = `<nav class="manifest"><ul>
  ${session('saturday-morning-session', 'Saturday Morning Session')}
  ${tile('11christofferson', 'D. Todd Christofferson', 'Sustaining of General Authorities, Area Seventies, and General Officers')}
  ${tile('12gong', 'Gerrit W. Gong', 'Come to the Lord in His Holy House')}
  ${session('sunday-afternoon-session', 'Sunday Afternoon Session')}
  ${tile('510oaks', 'Dallin H. Oaks', 'Closing Remarks')}
</ul></nav>`;

describe('parseManifest', () => {
  it('lists talks in order with their session, skipping business items', () => {
    expect(parseManifest(html)).toEqual([
      { slug: '12gong', uri: '/general-conference/2026/10/12gong', speaker: 'Gerrit W. Gong', title: 'Come to the Lord in His Holy House', session: 'Saturday Morning Session', order: 1 },
      { slug: '510oaks', uri: '/general-conference/2026/10/510oaks', speaker: 'Dallin H. Oaks', title: 'Closing Remarks', session: 'Sunday Afternoon Session', order: 2 },
    ]);
  });
});
