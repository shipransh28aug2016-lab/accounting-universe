/** Small seeded PRNG (mulberry32) so a question is reproducible from its seed — needed for tests, sharing and retries. */
export class Rng {
  private s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** integer in [lo, hi] inclusive */
  int(lo: number, hi: number): number { return lo + Math.floor(this.next() * (hi - lo + 1)); }
  pick<T>(xs: readonly T[]): T { return xs[this.int(0, xs.length - 1)]!; }
  /** a multiple of `step` in [lo, hi] */
  multiple(lo: number, hi: number, step: number): number { return step * this.int(Math.ceil(lo / step), Math.floor(hi / step)); }
}
