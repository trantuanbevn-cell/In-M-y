import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import ProductCard from '../components/ProductCard.jsx'

export default function Products() {
  const [params, setParams] = useSearchParams()
  const [cats, setCats] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const slug = params.get('c') || ''

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('ordering')
      .then(({ data }) => setCats(data || []))
  }, [])

  useEffect(() => {
    setLoading(true)
    supabase
      .from('products')
      .select('*, categories(slug)')
      .eq('is_active', true)
      .order('ordering')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setItems(data || [])
        setLoading(false)
      })
  }, [])

  const shown = items.filter(
    (p) =>
      (!slug || p.categories?.slug === slug) &&
      (!q || (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div className="container section">
      <h1>Sản phẩm</h1>
      <div className="toolbar">
        <div className="chips">
          <button className={'chip' + (!slug ? ' on' : '')} onClick={() => setParams({})}>
            Tất cả
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              className={'chip' + (slug === c.slug ? ' on' : '')}
              onClick={() => setParams({ c: c.slug })}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
        <input className="search" placeholder="Tìm sản phẩm…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {loading ? (
        <p className="muted">Đang tải…</p>
      ) : shown.length === 0 ? (
        <p className="muted">Chưa có sản phẩm phù hợp.</p>
      ) : (
        <div className="grid">
          {shown.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}
