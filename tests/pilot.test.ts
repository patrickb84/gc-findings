import { describe, expect, it } from 'vitest';
import { PROPHET_ROLE, selectPilot } from '../src/pilot.ts';

const t = (slug: string, speaker: string, order: number, role = 'Of the Quorum of the Twelve Apostles') => ({ slug, speaker, role, order });

describe('selectPilot', () => {
  it('takes first, last, every prophet talk and requested speakers', () => {
    const talks = [
      t('12gong', 'Gerrit W. Gong', 1),
      t('13runia', 'Tamara W. Runia', 2),
      t('48schmeil', 'Ciro Schmeil', 3),
      t('49oaks', 'Dallin H. Oaks', 4, PROPHET_ROLE),
      t('58reid', 'Gabriel W. Reid', 5),
      t('59gilbert', 'Clark G. Gilbert', 6),
      t('510oaks', 'Dallin H. Oaks', 7, PROPHET_ROLE),
    ];
    expect(selectPilot(talks, ['Ciro Schmeil'])).toEqual(['12gong', '48schmeil', '49oaks', '59gilbert', '510oaks']);
  });

  it('does not add the second-to-last talk when the last is not the prophet', () => {
    const talks = [t('a', 'A', 1), t('b', 'B', 2), t('c', 'C', 3)];
    expect(selectPilot(talks, [])).toEqual(['a', 'c']);
  });

  it('matches requested speakers without accents or case', () => {
    const talks = [t('a', 'A', 1), t('52munoz-spannaus', 'Andrea Muñoz Spannaus', 2), t('c', 'C', 3)];
    expect(selectPilot(talks, ['andrea munoz'])).toEqual(['a', '52munoz-spannaus', 'c']);
  });

  it('fails loudly when a requested speaker gave no talk', () => {
    expect(() => selectPilot([t('a', 'A', 1)], ['Nobody Here'])).toThrow('No talk by "Nobody Here"');
  });
});
