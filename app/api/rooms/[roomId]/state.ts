import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServerClient } from '../../_supabaseServer'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end()

  const { roomId, since } = req.query as { roomId: string; since?: string }
  const supabase = createServerClient()

  const { data: room, error } = await supabase
    .from('rooms')
    .select('version, state_json, status')
    .eq('id', roomId)
    .single()

  if (error || !room) return res.status(404).json({ error: 'Room not found' })

  // Version-gated: 304 if client already has latest
  if (since !== undefined && Number(since) >= room.version) {
    return res.status(304).end()
  }

  res.json({ version: room.version, state: room.state_json, status: room.status })
}
