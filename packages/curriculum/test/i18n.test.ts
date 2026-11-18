import { describe, expect, it } from 'vitest';
import { EN, HI, HINDI_REVIEWED, t } from '../src/i18n';

const DEVANAGARI = /[ऀ-ॿ]/;
describe('V1 UI string catalogue (T0.4)', () => {
  it('English and Hindi have exactly the same keys', () => { expect(Object.keys(HI).sort()).toEqual(Object.keys(EN).sort()); });
  it('every Hindi string contains Devanagari (except the switch back to English)', () => {
    for (const [k, v] of Object.entries(HI)) if (k !== 'lang.toggle') expect(v, k).toMatch(DEVANAGARI);
  });
  it('placeholders match between languages, and t() fills them', () => {
    for (const k of Object.keys(EN) as (keyof typeof EN)[]) expect((HI[k].match(/\{\w+\}/g) ?? []).sort(), k).toEqual((EN[k].match(/\{\w+\}/g) ?? []).sort());
    expect(t('en', 'practice.scored', { marks: 2, outOf: 3 })).toBe('You scored 2 / 3.');
    expect(t('hi', 'practice.scored', { marks: 2, outOf: 3 })).toBe('आपके अंक 2 / 3।');
  });
  it('Hindi stays labelled as an unreviewed draft until a reviewer signs it off (D10)', () => { expect(HINDI_REVIEWED).toBe(false); });
});

describe('whole-app chrome strings (Phase 2)', () => {
  it('every syllabus unit has a Hindi title', async () => {
    const { UNITS } = await import('../src');
    for (const u of UNITS) { expect(`unit.${u.id}` in EN, u.id).toBe(true); expect(EN[`unit.${u.id}` as keyof typeof EN], u.id).toBe(u.title); }
  });
  it('every navigation label has a translation under the same key the route table uses', async () => {
    const { NAV } = await import('../../../apps/web/src/routes');
    for (const n of NAV) { expect(EN[`nav.${n.key}` as keyof typeof EN], n.key).toBe(n.key); expect(HI[`nav.${n.key}` as keyof typeof HI], n.key).toMatch(/[ऀ-ॿ]/); }
  });
  it('the English side keeps the exact wording the app used before (tests and users rely on it)', () => {
    expect(EN['home.start']).toBe('Start here: '); expect(EN['labs.count.n']).toBe('{n} labs shown'); expect(EN['ui.menu']).toBe('☰ Menu');
  });
});
