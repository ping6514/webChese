import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServerClient, genId, genSecret } from '../_supabaseServer'
import { createInitialState } from '../../src/engine'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createServerClient()
  const roomId = genId(6)
  const redSecret = genSecret()
  const initialState = createInitialState()

  const { error } = await supabase.from('rooms').insert({
    id: roomId,
    version: 0,
    state_json: initialState,
    status: 'waiting',
    red_secret: redSecret,
    black_secret: null,
  })

  if (error) return res.status(500).json({ error: error.message })

  res.json({ roomId, secret: redSecret, side: 'red' })
}
