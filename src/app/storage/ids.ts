// Monotonic ULIDs: 26 chars, lexicographically sortable by creation time. Event order is defined
// by these ids (never by the `at` timestamp), so even a clock that jumps backwards can't reorder
// answers, and backups merged from two devices interleave correctly.
const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

let lastTime = -1;
let lastRand: number[] = [];

function randomDigits(n: number): number[] {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b & 31);
}

export function ulid(now: number = Date.now()): string {
  if (now <= lastTime) {
    // Same millisecond (or the clock went back): increment the random part to stay monotonic.
    for (let i = lastRand.length - 1; i >= 0; i--) {
      if (lastRand[i]! < 31) {
        lastRand[i] = lastRand[i]! + 1;
        break;
      }
      lastRand[i] = 0;
    }
  } else {
    lastTime = now;
    lastRand = randomDigits(16);
  }
  let t = lastTime;
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = ENC[t % 32]! + time;
    t = Math.floor(t / 32);
  }
  return time + lastRand.map((d) => ENC[d]!).join('');
}
