import darkMoon from '../data/souls/dark-moon.json'
import styx from '../data/souls/styx.json'
import type { PieceBase } from './types'

export type SoulAbility = {
  type: string
  [k: string]: unknown
}

export type SoulCard = {
  id: string
  clan: string
  base: PieceBase
  name: string
  image: string
  costGold: number
  stats: {
    hp: number
    atk: { key: string; value: number }
    def: Array<{ key: string; value: number }>
  }
  abilities: SoulAbility[]
  text?: string
}

function normalizePublicAssetUrl(p: string): string {
  if (!p) return p
  if (p.startsWith('/')) return `${import.meta.env.BASE_URL}${p.slice(1)}`
  return p
}

const allSoulCards: SoulCard[] = [...(darkMoon as SoulCard[]), ...(styx as SoulCard[])]
  .map((c) => ({ ...c, image: normalizePublicAssetUrl(String((c as any).image ?? '')) }))

export const soulCardsById: Record<string, SoulCard> = Object.fromEntries(allSoulCards.map((c) => [c.id, c]))

export function getSoulCard(id: string): SoulCard | undefined {
  return soulCardsById[id]
}

export function listSoulCards(): SoulCard[] {
  return allSoulCards
}
