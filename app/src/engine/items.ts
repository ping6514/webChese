export type ItemCard = {
  id: string
  name: string
  costGold: number
  timing?: 'buy' | 'combat' | 'necro'
  image?: string | null
  text?: string
  copies?: number
}

import rulebookItems from '../data/items/rulebook-items.json'

const allItemCards: ItemCard[] = [...(rulebookItems as ItemCard[])]

export const itemCardsById: Record<string, ItemCard> = Object.fromEntries(allItemCards.map((c) => [c.id, c]))

export function getItemCard(id: string): ItemCard | undefined {
  return itemCardsById[id]
}

export function listItemCards(): ItemCard[] {
  return allItemCards
}

export function listItemDeckIds(): string[] {
  const sorted = allItemCards.slice().sort((a, b) => a.id.localeCompare(b.id))
  const out: string[] = []
  for (const c of sorted) {
    const n = Number.isInteger(c.copies) && (c.copies as number) > 0 ? (c.copies as number) : 1
    for (let i = 0; i < n; i++) out.push(c.id)
  }
  return out
}
