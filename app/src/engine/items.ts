export type ItemCard = {
  id: string
  name: string
  costGold: number
  timing?: 'buy' | 'combat' | 'necro'
  image?: string | null
  text?: string
  copies?: number
  effect?: {
    goldAmount?: number
    manaAmount?: number
  }
}

import rulebookItems from '../data/items/rulebook-items.json'

function normalizePublicAssetUrl(p: string): string {
  return p
}

const allItemCards: ItemCard[] = [...(rulebookItems as ItemCard[])]
  .map((c) => ({ ...c, image: c.image ? normalizePublicAssetUrl(String(c.image)) : c.image }))

export const itemCardsById: Record<string, ItemCard> = Object.fromEntries(allItemCards.map((c) => [c.id, c]))

export function getItemCard(id: string): ItemCard | undefined {
  return itemCardsById[id]
}

export function listItemCards(): ItemCard[] {
  return allItemCards
}

// 已在 reduce.ts 中實作效果的道具 ID 集合（未實作的不加入牌組）
const IMPLEMENTED_ITEM_IDS = new Set([
  'item_lingxue_holy_grail',
  'item_bone_refine',
  'item_dead_return_path',
  'item_wizard_greed',
  'item_soul_infusion',
  'item_soul_overload',
  'item_last_stand_contract',
  'item_dark_moon_scope',
  'item_death_chain',
  'item_nether_seal',
  'item_cage_plunder',
  'item_soul_detach_needle',
])

export function listItemDeckIds(): string[] {
  const sorted = allItemCards
    .filter((c) => IMPLEMENTED_ITEM_IDS.has(c.id))
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
  const out: string[] = []
  for (const c of sorted) {
    const n = Number.isInteger(c.copies) && (c.copies as number) > 0 ? (c.copies as number) : 1
    for (let i = 0; i < n; i++) out.push(c.id)
  }
  return out
}
