import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase.js'

const STATUS = { draft: 'Nháp', review: 'Chờ duyệt', approved: 'Đã duyệt', published: 'Đã đăng' }

export default function Studio() {
  const nav = useNavigate()
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    const [p, pr] = await Promise.all([
      supabase
        .from('studio_projects')
        .select('*, products(name), studio_assets(id,kind,url,approved)')
        .order('created_at', { ascending: false }),
      supabase.from('products').select('id,name').order('name'),
    ])
    setRows(p.data || [])
    setProducts(pr.data || [])
  }
  useEffect(() => {
    load()
  }, [])

  const create = async (e) => {
    e.preventDefault()
    setErr('')
    const prod = products.find((x) => x.id === f.product_id)
    const { data, error } = await supabase
      .from('studio_projects')
      .insert({ title: f.title.trim() || prod?.name || 'Dự án mới', product_id: f.product_id || null })
      .select('id')
      .single()
    if (error) return setErr(error.message)
    nav(`/admin/studio/${data.id}`)
  }

  return (
    <div>
      <div className="row between">
        <h1>🎬 Studio</h1>
        <div className="row">
          <Link className="btn ghost" to="/admin/studio/thu-vien">
            Thư viện lựa chọn
          </Link>
          <button className="btn" onClick={() => setF({ title: '', product_id: '' })}>
            + Dự án mới
          </button>
        </div>
      </div>
      <p className="muted">
        Chụp ảnh sản phẩm thật → chọn phong cách → tạo poster, ảnh góc và video → duyệt → đăng lên trang sản phẩm.
      </p>

      {rows.length === 0 && <p className="muted">Chưa có dự án nào. Bấm “Dự án mới” để bắt đầu.</p>}
      <div className="grid studio-list">
        {rows.map((r) => {
          const cover =
            r.studio_assets.find((a) => a.kind === 'poster' && a.approved) ||
            r.studio_assets.find((a) => a.kind === 'poster') ||
            r.studio_assets.find((a) => a.kind === 'photo')
          return (
            <Link key={r.id} to={`/admin/studio/${r.id}`} className="card">
              <div className="card-img">{cover ? <img src={cover.url} alt="" /> : <span className="ph">🎬</span>}</div>
              <div className="card-body">
                <h3>{r.title}</h3>
                <p className="muted small">
                  {r.products?.name ? `Sản phẩm: ${r.products.name}` : 'Chưa gắn sản phẩm'}
                </p>
                <span className="st">{STATUS[r.status]}</span>
              </div>
            </Link>
          )
        })}
      </div>

      {f && (
        <div className="modal" onClick={() => setF(null)}>
          <form className="form" onClick={(e) => e.stopPropagation()} onSubmit={create}>
            <h3>Dự án Studio mới</h3>
            <label>
              Gắn với sản phẩm (tuỳ chọn)
              <select value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })}>
                <option value="">— Chưa gắn —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tên dự án
              <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="VD: Bộ keycap Halloween" />
            </label>
            {err && <p className="error">{err}</p>}
            <div className="row">
              <button className="btn">Tạo</button>
              <button type="button" className="btn ghost" onClick={() => setF(null)}>
                Huỷ
              </button>
            </div>
            {products.length === 0 && (
              <p className="muted small">Bạn chưa có sản phẩm nào. Có thể tạo dự án trước, gắn sản phẩm sau.</p>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
