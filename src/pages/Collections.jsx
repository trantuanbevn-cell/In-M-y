import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase.js'

export default function Collections() {
  const [items, setItems] = useState(null)

  useEffect(() => {
    supabase
      .from('collections')
      .select('*')
      .eq('is_active', true)
      .order('ordering')
      .then(({ data }) => setItems(data || []))
  }, [])

  return (
    <div className="container section">
      <h1>Bộ sưu tập</h1>
      {items === null ? (
        <p className="muted">Đang tải…</p>
      ) : items.length === 0 ? (
        <p className="muted">Chưa có bộ sưu tập nào.</p>
      ) : (
        <div className="grid">
          {items.map((c) => (
            <Link key={c.id} to={`/bo-suu-tap/${c.slug}`} className="card">
              <div className="card-img">
                {c.cover_image_url ? <img src={c.cover_image_url} alt={c.name} loading="lazy" /> : <span className="ph">☁️</span>}
              </div>
              <div className="card-body">
                <h3>{c.name}</h3>
                {c.description && <p className="muted clamp">{c.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
