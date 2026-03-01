import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServerClient, genId, genSecret } from '../_supabaseServer'
import { createInitialState } from '../_engine/engine'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const supabase = createServerClient()
    const roomId = genId(6)
    const creatorSecret = genSecret()
    const creatorSide: 'red' | 'black' = Math.random() < 0.5 ? 'red' : 'black'
    const firstSide: 'red' | 'black' = Math.random() < 0.5 ? 'red' : 'black'
    const ALL_CLANS = ['dark_moon', 'styx', 'eternal_night', 'iron_guard']
    const rawClans: unknown = req.body?.enabledClans
    const enabledClans: string[] = Array.isArray(rawClans) && rawClans.length > 0
      ? (rawClans as string[]).filter((c) => ALL_CLANS.includes(c))
      : ALL_CLANS
    const safeClans = enabledClans.length > 0 ? enabledClans : ALL_CLANS
    const initialState = createInitialState({ rules: { firstSide, enabledClans: safeClans } as any })

    const { error } = await supabase.from('rooms').insert({
      id: roomId,
      version: 0,
      state_json: initialState,
      status: 'waiting',
      red_secret: creatorSide === 'red' ? creatorSecret : null,
      black_secret: creatorSide === 'black' ? creatorSecret : null,
    })

    if (error) return res.status(500).json({ error: error.message })

    res.json({ roomId, secret: creatorSecret, side: creatorSide })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack?.slice(0, 600) : undefined
    return res.status(500).json({ error: msg, stack })
  }
}
