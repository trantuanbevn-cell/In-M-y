import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import ProductCard from '../components/ProductCard.jsx'

export default function CollectionDetail() {
  const { slug } = useParams()
  const [col, setCol] = useState(undefined)
  const [items, setItems] = useState([])

  useEffect(() => {
    setCol(undefined)
    supabase
      .from('collections')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()
      .then(async ({ data }) => {
        setCol(data || null)
        if (!data) return
        const { data: rows } = await supabase
          .from('collection_products')
          .select('ordering, products(*)')
          .eq('collection_id', data.id)
          .order('ordering')
        setItems((rows || []).map((r) => r.products).filter((p) => p && p.is_active))
      })
  }, [slug])

  if (col === undefined) return <div className="container section muted">Đang tải…</div>
  if (col === null)
    return (
      <div className="container section">
        <p>Không tìm thấy bộ sưu tập.</p>
        <Link to="/bo-suu-tap">← Về danh sách</Link>
      </div>
    )

  return (
    <div className="container section">
      <p className="muted">
        <Link to="/bo-suu-tap">Bộ sưu tập</Link>
      </p>
      <h1>{col.name}</h1>
      {col.description && <p className="desc">{col.description}</p>}
      {items.length === 0 ? (
        <p className="muted">Bộ sưu tập chưa có sản phẩm.</p>
      ) : (
        <div className="grid">
          {items.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  )
}
