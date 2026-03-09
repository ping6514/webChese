import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function missingEnvError() {
  return new Error('Supabase env is missing: please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (client).')
}

export const supabase = (url && key)
  ? createClient(url, key)
  : ({
      channel() { throw missingEnvError() },
      removeChannel() { /* noop */ },
    } as any)
