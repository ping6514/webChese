import type { VercelRequest, VercelResponse } from '@vercel/node'

/* eslint-disable @typescript-eslint/no-require-imports */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    // Use require() so the import happens inside try/catch
    const engine = require('./_engine/engine') as typeof import('../src/engine')
    const state = engine.createInitialState()
    res.json({ ok: true, stateKeys: Object.keys(state).slice(0, 10) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const stack = e instanceof Error ? e.stack?.slice(0, 1200) : undefined
    res.status(500).json({ error: msg, stack })
  }
}
