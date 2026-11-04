import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase.js'

const Ctx = createContext({ settings: {}, loading: true, reload: () => {} })

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)

  const reload = async () => {
    const { data } = await supabase.from('settings').select('key,value')
    const obj = {}
    ;(data || []).forEach((r) => (obj[r.key] = r.value))
    setSettings(obj)
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  return <Ctx.Provider value={{ settings, loading, reload }}>{children}</Ctx.Provider>
}

export const useSettings = () => useContext(Ctx)
