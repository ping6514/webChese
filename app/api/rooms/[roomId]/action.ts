import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServerClient } from '../../_supabaseServer'
import { canDispatch, reduce } from '../../_engine/engine'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { roomId } = req.query as { roomId: string }
  const { action, secret, side } = req.body as {
    action: unknown
    secret: string
    side: 'red' | 'black'
  }

  if (!action || !secret || !side) {
    return res.status(400).json({ error: 'Missing action / secret / side' })
  }

  const supabase = createServerClient()
  const { data: room, error: fetchErr } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single()

  if (fetchErr || !room) return res.status(404).json({ error: 'Room not found' })
  if (room.status === 'finished') return res.status(400).json({ error: 'Game is finished' })

  const expectedSecret = side === 'red' ? room.red_secret : room.black_secret
  if (!expectedSecret || secret !== expectedSecret) {
    return res.status(403).json({ error: 'Invalid secret' })
  }

  // Special-case: SURRENDER can be sent anytime, but can only surrender your own side.
  if ((action as any)?.type === 'SURRENDER') {
    const actionSide = (action as any)?.side
    if (actionSide !== side) {
      return res.status(400).json({ error: 'Invalid surrender side' })
    }
  }

  const state = room.state_json
  const guard = canDispatch(state, action as any)
  if (!guard.ok) return res.status(400).json({ error: guard.reason })

  const result = reduce(state, action as any)

  const { error: updateErr } = await supabase
    .from('rooms')
    .update({
      state_json: { ...result.state, _lastEvents: result.events },
      version: room.version + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', roomId)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  res.json({ ok: true, version: room.version + 1, events: result.events })
}
