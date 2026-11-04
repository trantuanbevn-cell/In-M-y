import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://octgcomcfhspldehdvev.supabase.co'
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_b7E1qGKck9JwQ9pqxv5V7w_EXn-zHGG'

export const supabase = createClient(url, key)
export const BUCKET = 'product-images'
