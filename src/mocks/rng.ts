// Воспроизводимый детерминированный PRNG (mulberry32)
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = mulberry32(20260529);

export function pick<T>(arr: T[], r = rand): T {
  return arr[Math.floor(r() * arr.length)]!;
}

export function pickWeighted<T>(items: { value: T; weight: number }[], r = rand): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let p = r() * total;
  for (const i of items) {
    if ((p -= i.weight) <= 0) return i.value;
  }
  return items[items.length - 1]!.value;
}

export function randInt(min: number, max: number, r = rand) {
  return Math.floor(r() * (max - min + 1)) + min;
}

export function randFloat(min: number, max: number, r = rand) {
  return r() * (max - min) + min;
}

export function pad(n: number, width: number) {
  return String(n).padStart(width, '0');
}
