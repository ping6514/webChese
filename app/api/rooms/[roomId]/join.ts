import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServerClient, genSecret } from '../../_supabaseServer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { roomId } = req.query as { roomId: string }
  const supabase = createServerClient()

  const { data: room, error: fetchErr } = await supabase
    .from('rooms')
    .select('id, status, black_secret')
    .eq('id', roomId)
    .single()

  if (fetchErr || !room) return res.status(404).json({ error: 'Room not found' })
  if (room.black_secret) return res.status(400).json({ error: 'Room is full' })

  const blackSecret = genSecret()
  const { error } = await supabase
    .from('rooms')
    .update({ black_secret: blackSecret, status: 'playing' })
    .eq('id', roomId)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ roomId, secret: blackSecret, side: 'black' })
}
