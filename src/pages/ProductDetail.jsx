import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { vnd } from '../lib.js'
import OrderForm from '../components/OrderForm.jsx'

export default function ProductDetail() {
  const { slug } = useParams()
  const [p, setP] = useState(undefined)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setP(undefined)
    setIdx(0)
    supabase
      .from('products')
      .select('*, categories(name,slug)')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => setP(data || null))
  }, [slug])

  if (p === undefined) return <div className="container section muted">Đang tải…</div>
  if (p === null)
    return (
      <div className="container section">
        <p>Không tìm thấy sản phẩm.</p>
        <Link to="/san-pham">← Về danh sách</Link>
      </div>
    )

  const imgs = p.images || []
  return (
    <div className="container section detail">
      <div>
        <div className="big-img">
          {imgs[idx] ? <img src={imgs[idx]} alt={p.name} /> : <span className="ph">☁️</span>}
        </div>
        {imgs.length > 1 && (
          <div className="thumbs">
            {imgs.map((u, i) => (
              <img key={u} src={u} alt="" className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} />
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="muted">
          <Link to="/san-pham">Sản phẩm</Link>
          {p.categories && (
            <>
              {' / '}
              <Link to={`/san-pham?c=${p.categories.slug}`}>{p.categories.name}</Link>
            </>
          )}
        </p>
        <h1>{p.name}</h1>
        {p.badge && <span className="badge static">{p.badge}</span>}
        <p className="price big">{p.price > 0 ? vnd(p.price) : 'Liên hệ báo giá'}</p>
        {p.description && <p className="desc">{p.description}</p>}
        {p.tags?.length > 0 && (
          <div className="chips">
            {p.tags.map((t) => (
              <span key={t} className="chip small">
                #{t}
              </span>
            ))}
          </div>
        )}
        <OrderForm product={p} title="Đặt sản phẩm này" />
      </div>
    </div>
  )
}
