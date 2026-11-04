import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { useSettings } from '../components/Settings.jsx'
import ProductCard from '../components/ProductCard.jsx'
import { INTERESTS, inInterest } from '../interests.js'

function Banner({ b }) {
  const inner = (
    <>
      <img src={b.image_url} alt="" />
      <div className="bt">
        <h2>{b.title}</h2>
        {b.subtitle && <p>{b.subtitle}</p>}
        {b.link && <span className="bt-cta">{b.cta_label || 'Xem ngay'}</span>}
      </div>
    </>
  )
  if (!b.link) return <div className="banner">{inner}</div>
  return /^https?:/.test(b.link) ? (
    <a className="banner" href={b.link} target="_blank" rel="noreferrer">{inner}</a>
  ) : (
    <Link className="banner" to={b.link}>{inner}</Link>
  )
}

export default function Home() {
  const { settings } = useSettings()
  const [products, setProducts] = useState([])
  const [banners, setBanners] = useState([])

  useEffect(() => {
    supabase
      .from('campaigns')
      .select('*')
      .eq('is_active', true)
      .order('ordering')
      .then(({ data }) => setBanners((data || []).filter((b) => b.image_url)))
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('ordering')
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data }) => setProducts(data || []))
  }, [])

  const counts = useMemo(
    () => Object.fromEntries(INTERESTS.map((it) => [it.slug, products.filter((p) => inInterest(p, it)).length])),
    [products],
  )

  const words = (settings.tagline || 'In những giấc mơ').split(' ')
  const head = words.slice(0, -2).join(' ')
  const tail = words.slice(-2).join(' ')
  const story = settings.story

  return (
    <>
      <section className="hero">
        <div className="container hero-in">
          <h1>
            {head && <span className="h-head">{head}</span>}
            <span className="h-print" aria-label={tail}>
              <span aria-hidden="true">{tail}</span>
            </span>
          </h1>
          <p className="hero-sub">{settings.sub_tagline || 'Đồ in 3D làm riêng theo ý bạn.'}</p>
          <div className="row hero-cta">
            <a href="#so-thich" className="btn">Chọn theo sở thích</a>
            <Link to="/dat-rieng" className="btn ghost">Kể ý tưởng của bạn</Link>
          </div>
        </div>
        <div className="hero-clouds" aria-hidden="true">
          <i /><i /><i />
        </div>
      </section>

      {banners.length > 0 && (
        <section className="container banners">
          {banners.map((b) => (
            <Banner key={b.id} b={b} />
          ))}
        </section>
      )}

      <section className="container block" id="so-thich">
        <h2 className="h2">Bạn đang mơ về điều gì?</h2>
        <div className="tiles">
          {INTERESTS.map((it, i) => (
            <Link
              key={it.slug}
              to={`/san-pham?s=${it.slug}`}
              className={'tile t' + (i % 4)}
              style={{ '--c': it.color, '--k': it.ink }}
            >
              <span className="tile-name">{it.name}</span>
              <span className="tile-line">{it.line}</span>
              {counts[it.slug] > 0 && <span className="tile-n">{counts[it.slug]} món</span>}
            </Link>
          ))}
        </div>
      </section>

      {products.length > 0 && (
        <section className="container block">
          <div className="row between">
            <h2 className="h2">Mới ra lò</h2>
            <Link to="/san-pham" className="more">Xem tất cả</Link>
          </div>
          <div className="grid">
            {products.slice(0, 8).map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      <section className="container block">
        <h2 className="h2">Từ giấc mơ đến vật thật</h2>
        <ol className="steps3">
          <li>
            <b>Kể ý tưởng</b>
            <span>Gửi ảnh, ý tưởng hay món bạn đang mê. Chưa rõ cũng được, InMây hỏi thêm.</span>
          </li>
          <li>
            <b>Chốt mẫu</b>
            <span>InMây liên hệ để thống nhất mẫu, màu, giá và thời gian làm.</span>
          </li>
          <li>
            <b>Nhận vật thật</b>
            <span>Món đồ được in, hoàn thiện và gửi đến bạn.</span>
          </li>
        </ol>
      </section>

      {story && story.title && (
        <section className="story">
          <div className="container narrow">
            <h2 className="h2">{story.title}</h2>
            {(story.body || []).map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        </section>
      )}

      {settings.closing_message && (
        <section className="container closing">
          <p>{settings.closing_message}</p>
          <Link to="/dat-rieng" className="btn">Bắt đầu ý tưởng của bạn</Link>
        </section>
      )}
    </>
  )
}
