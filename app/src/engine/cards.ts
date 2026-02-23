import darkMoon from '../data/souls/dark-moon.json'

export type SoulAbility = {
  type: string
  [k: string]: unknown
}

export type SoulCard = {
  id: string
  clan: string
  base: string
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

const allSoulCards: SoulCard[] = [...(darkMoon as SoulCard[])]

export const soulCardsById: Record<string, SoulCard> = Object.fromEntries(allSoulCards.map((c) => [c.id, c]))

export function getSoulCard(id: string): SoulCard | undefined {
  return soulCardsById[id]
}

export function listSoulCards(): SoulCard[] {
  return allSoulCards
}
