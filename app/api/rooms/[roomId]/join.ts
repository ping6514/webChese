import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServerClient, genSecret } from '../../_supabaseServer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { roomId } = req.query as { roomId: string }
  const supabase = createServerClient()

  const { data: room, error: fetchErr } = await supabase
    .from('rooms')
    .select('id, status, red_secret, black_secret')
    .eq('id', roomId)
    .single()

  if (fetchErr || !room) return res.status(404).json({ error: 'Room not found' })
  if (room.red_secret && room.black_secret) return res.status(400).json({ error: 'Room is full' })
  if (room.status !== 'waiting') return res.status(400).json({ error: 'Room already started' })

  const joinerSide: 'red' | 'black' = room.red_secret ? 'black' : 'red'
  const joinerSecret = genSecret()
  const updateFields = joinerSide === 'red'
    ? { red_secret: joinerSecret, status: 'playing', version: 1 }
    : { black_secret: joinerSecret, status: 'playing', version: 1 }

  const { error } = await supabase
    .from('rooms')
    .update(updateFields)
    .eq('id', roomId)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ roomId, secret: joinerSecret, side: joinerSide })
}
