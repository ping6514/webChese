import { createClient } from '@supabase/supabase-js'

export function createServerClient() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase server env vars')
  return createClient(url, key, { auth: { persistSession: false } })
}

export function genId(len = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function genSecret(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
}
