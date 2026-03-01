import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createServerClient } from './_supabaseServer'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Step 1: env vars
  const urlOk = !!process.env.VITE_SUPABASE_URL
  const keyOk = !!process.env.SUPABASE_SERVICE_ROLE_KEY

  // Step 2: Supabase connectivity (simple query)
  let dbOk = false
  let dbError: string | null = null
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('rooms').select('id').limit(1)
    dbOk = !error
    if (error) dbError = error.message
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e)
  }

  res.json({ ok: true, envUrlOk: urlOk, envKeyOk: keyOk, dbOk, dbError })
}
