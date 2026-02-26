export type RngState = {
  x: number
}

function hashSeedToU32(seed: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function createRngState(seed: string): RngState {
  return {
    x: hashSeedToU32(seed) || 0x12345678,
  }
}

export function nextU32(state: RngState): number {
  // xorshift32 (mutates state)
  state.x ^= state.x << 13
  state.x ^= state.x >>> 17
  state.x ^= state.x << 5
  state.x >>>= 0
  return state.x
}

export function rollDice(sides: number, rng: RngState): number {
  const s = Math.floor(sides)
  if (!(Number.isFinite(s) && s >= 2)) throw new Error('Invalid sides')
  const v = nextU32(rng) % s
  return v + 1
}

export function shuffleInPlace<T>(arr: T[], rng: RngState): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = nextU32(rng) % (i + 1)
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
}

export function shuffle<T>(arr: readonly T[], rng: RngState): T[] {
  const out = arr.slice() as T[]
  shuffleInPlace(out, rng)
  return out
}
