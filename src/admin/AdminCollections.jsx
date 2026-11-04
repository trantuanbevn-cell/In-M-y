import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { slugify } from '../lib.js'
import ImageUploader from './ImageUploader.jsx'

const EMPTY = { name: '', slug: '', description: '', cover_image_url: '', ordering: 0, is_active: true, productIds: [] }

export default function AdminCollections() {
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    const [c, p] = await Promise.all([
      supabase.from('collections').select('*').order('ordering'),
      supabase.from('products').select('id,name').order('name'),
    ])
    setRows(c.data || [])
    setProducts(p.data || [])
  }
  useEffect(() => {
    load()
  }, [])

  const edit = async (c) => {
    const { data } = await supabase.from('collection_products').select('product_id,ordering').eq('collection_id', c.id).order('ordering')
    setF({ ...c, cover_image_url: c.cover_image_url || '', productIds: (data || []).map((r) => r.product_id) })
  }

  const toggleProduct = (id) =>
    setF((s) => ({ ...s, productIds: s.productIds.includes(id) ? s.productIds.filter((x) => x !== id) : [...s.productIds, id] }))

  const save = async (e) => {
    e.preventDefault()
    setErr('')
    const payload = {
      name: f.name.trim(),
      slug: f.slug.trim() || slugify(f.name),
      description: f.description || null,
      cover_image_url: f.cover_image_url || null,
      ordering: Number(f.ordering) || 0,
      is_active: f.is_active,
    }
    let id = f.id
    if (id) {
      const { error } = await supabase.from('collections').update(payload).eq('id', id)
      if (error) return setErr(error.message)
    } else {
      const { data, error } = await supabase.from('collections').insert(payload).select('id').single()
      if (error) return setErr(error.message.includes('duplicate') ? 'Slug đã tồn tại, hãy đổi slug.' : error.message)
      id = data.id
    }
    const del = await supabase.from('collection_products').delete().eq('collection_id', id)
    if (del.error) return setErr(del.error.message)
    if (f.productIds.length) {
      const ins = await supabase
        .from('collection_products')
        .insert(f.productIds.map((pid, i) => ({ collection_id: id, product_id: pid, ordering: i })))
      if (ins.error) return setErr(ins.error.message)
    }
    setF(null)
    load()
  }

  const remove = async (c) => {
    if (!confirm(`Xoá bộ sưu tập "${c.name}"?`)) return
    await supabase.from('collection_products').delete().eq('collection_id', c.id)
    const { error } = await supabase.from('collections').delete().eq('id', c.id)
    if (error) return alert(error.message)
    load()
  }

  return (
    <div>
      <div className="row between">
        <h1>Bộ sưu tập</h1>
        <button className="btn" onClick={() => setF({ ...EMPTY })}>
          + Thêm bộ sưu tập
        </button>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th />
            <th>Tên</th>
            <th>Slug</th>
            <th>Hiện</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{c.cover_image_url ? <img className="mini" src={c.cover_image_url} alt="" /> : '☁️'}</td>
              <td>{c.name}</td>
              <td className="muted">{c.slug}</td>
              <td>{c.is_active ? '✓' : '—'}</td>
              <td className="right">
                <button className="linkbtn" onClick={() => edit(c)}>
                  Sửa
                </button>
                <button className="linkbtn danger" onClick={() => remove(c)}>
                  Xoá
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted">Chưa có bộ sưu tập.</p>}

      {f && (
        <div className="modal" onClick={() => setF(null)}>
          <form className="form wide" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3>{f.id ? 'Sửa bộ sưu tập' : 'Thêm bộ sưu tập'}</h3>
            <label>
              Tên *
              <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </label>
            <label>
              Slug (để trống sẽ tự tạo)
              <input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder={slugify(f.name)} />
            </label>
            <label>
              Mô tả
              <textarea rows="3" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </label>
            <div>
              <div className="lbl">Ảnh bìa</div>
              <ImageUploader
                multiple={false}
                images={f.cover_image_url ? [f.cover_image_url] : []}
                onChange={(arr) => setF({ ...f, cover_image_url: arr[0] || '' })}
              />
            </div>
            <div>
              <div className="lbl">Sản phẩm trong bộ sưu tập</div>
              <div className="picklist">
                {products.length === 0 && <span className="muted">Chưa có sản phẩm nào.</span>}
                {products.map((p) => (
                  <label key={p.id} className="check">
                    <input type="checkbox" checked={f.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="row">
              <label>
                Thứ tự
                <input type="number" value={f.ordering} onChange={(e) => setF({ ...f, ordering: e.target.value })} />
              </label>
              <label className="check">
                <input type="checkbox" checked={!!f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
                Hiển thị trên web
              </label>
            </div>
            {err && <p className="error">{err}</p>}
            <div className="row">
              <button className="btn">Lưu</button>
              <button type="button" className="btn ghost" onClick={() => setF(null)}>
                Huỷ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
