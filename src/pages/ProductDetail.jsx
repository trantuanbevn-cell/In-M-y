import { Fragment, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { vnd } from '../lib.js'
import OrderForm from '../components/OrderForm.jsx'

export const SPEC_LABELS = { material: 'Chất liệu', size: 'Kích thước', weight: 'Trọng lượng', color: 'Màu sắc', make_time: 'Thời gian làm' }
export const LINK_LABELS = { shopee: 'Shopee', tiktokShop: 'TikTok Shop', lazada: 'Lazada', facebook: 'Facebook', tiki: 'Tiki' }

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
        {p.video_url && (
          <video className="prod-video" src={p.video_url} controls playsInline preload="metadata" />
        )}
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
        <p className="price big">
          {p.sale_price > 0 && p.price > 0 ? vnd(p.sale_price) : p.price > 0 ? vnd(p.price) : 'Liên hệ báo giá'}
          {p.sale_price > 0 && p.price > 0 && <span className="price old">{vnd(p.price)}</span>}
        </p>
        {p.story && <p className="pstory">{p.story}</p>}
        {p.description && <p className="desc">{p.description}</p>}
        {Object.values(p.specs || {}).some(Boolean) && (
          <dl className="specs">
            {Object.entries(SPEC_LABELS).map(([k, label]) =>
              p.specs?.[k] ? (
                <Fragment key={k}>
                  <dt>{label}</dt>
                  <dd>{p.specs[k]}</dd>
                </Fragment>
              ) : null,
            )}
          </dl>
        )}
        {Object.values(p.links || {}).some(Boolean) && (
          <div className="shoplinks">
            {Object.entries(LINK_LABELS).map(([k, label]) =>
              p.links?.[k] ? (
                <a key={k} href={p.links[k]} target="_blank" rel="noreferrer">
                  Mua trên {label}
                </a>
              ) : null,
            )}
          </div>
        )}
        {p.tags?.length > 0 && (
          <div className="chips">
            {p.tags.map((t) => (
              <span key={t} className="chip small">
                #{t}
              </span>
            ))}
          </div>
        )}
        <div id="dat-hang"><OrderForm product={p} title="Đặt sản phẩm này" /></div>
      </div>
      <a className="buybar" href="#dat-hang">
        <span>{p.sale_price > 0 && p.price > 0 ? vnd(p.sale_price) : p.price > 0 ? vnd(p.price) : 'Liên hệ báo giá'}</span>
        <b>Đặt ngay</b>
      </a>
    </div>
  )
}
