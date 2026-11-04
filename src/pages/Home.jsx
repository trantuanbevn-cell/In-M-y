import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { useSettings } from '../components/Settings.jsx'
import ProductCard from '../components/ProductCard.jsx'

export default function Home() {
  const { settings } = useSettings()
  const [featured, setFeatured] = useState([])
  const [cats, setCats] = useState([])

  useEffect(() => {
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .eq('is_featured', true)
      .order('ordering')
      .limit(8)
      .then(({ data }) => setFeatured(data || []))
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('ordering')
      .then(({ data }) => setCats(data || []))
  }, [])

  const story = settings.story

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>{settings.tagline || 'In những giấc mơ'}</h1>
          <p>{settings.sub_tagline}</p>
          <div className="row">
            <Link to="/san-pham" className="btn">
              Xem sản phẩm
            </Link>
            <Link to="/dat-rieng" className="btn ghost">
              Đặt làm riêng
            </Link>
          </div>
        </div>
      </section>

      {cats.length > 0 && (
        <section className="container section">
          <h2>Danh mục</h2>
          <div className="chips">
            {cats.map((c) => (
              <Link key={c.id} to={`/san-pham?c=${c.slug}`} className="chip">
                {c.icon} {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="container section">
          <h2>Sản phẩm nổi bật</h2>
          <div className="grid">
            {featured.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </section>
      )}

      {story && (
        <section className="story">
          <div className="container narrow">
            <h2>{story.title}</h2>
            {(story.body || []).map((t, i) => (
              <p key={i}>{t}</p>
            ))}
          </div>
        </section>
      )}

      {settings.closing_message && (
        <section className="container section center">
          <p className="closing">{settings.closing_message}</p>
          <Link to="/dat-rieng" className="btn">
            Bắt đầu ý tưởng của bạn
          </Link>
        </section>
      )}
    </>
  )
}
