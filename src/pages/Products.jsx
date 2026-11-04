import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import ProductCard from '../components/ProductCard.jsx'
import { INTERESTS, inInterest, interestOf } from '../interests.js'

export default function Products() {
  const [params, setParams] = useSearchParams()
  const [cats, setCats] = useState([])
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const slug = params.get('c') || ''
  const sp = params.get('s') || ''
  const interest = interestOf(sp)

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
      (!interest || inInterest(p, interest)) &&
      (!q || (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q.toLowerCase()))
  )

  return (
    <div className="container section">
      <h1 className="page-h">{interest ? interest.name : 'Tất cả giấc mơ'}</h1>
      <p className="muted page-sub">{interest ? interest.line : 'Chọn một sở thích để xem đúng thứ bạn mê.'}</p>
      <div className="chips hobby">
        <button className={'chip' + (!sp ? ' on' : '')} onClick={() => setParams({})}>
          Tất cả
        </button>
        {INTERESTS.map((it) => (
          <button
            key={it.slug}
            className={'chip' + (sp === it.slug ? ' on' : '')}
            style={{ '--c': it.color, '--k': it.ink }}
            onClick={() => setParams({ s: it.slug })}
          >
            {it.name}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="chips">
          {cats.map((c) => (
            <button
              key={c.id}
              className={'chip plain' + (slug === c.slug ? ' on' : '')}
              onClick={() => setParams(sp ? { s: sp, c: c.slug } : { c: c.slug })}
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
        <p className="muted">Chưa có món nào cho mục này. <a href="/dat-rieng">Kể ý tưởng của bạn</a> để InMây làm riêng.</p>
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
