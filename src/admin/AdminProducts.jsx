import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { slugify, vnd } from '../lib.js'
import ImageUploader from './ImageUploader.jsx'

const EMPTY = {
  name: '',
  slug: '',
  description: '',
  price: 0,
  category_id: '',
  images: [],
  tagsText: '',
  badge: '',
  is_active: true,
  is_featured: false,
  ordering: 0,
}

export default function AdminProducts() {
  const [rows, setRows] = useState([])
  const [cats, setCats] = useState([])
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    const [p, c] = await Promise.all([
      supabase.from('products').select('*, categories(name)').order('ordering').order('created_at', { ascending: false }),
      supabase.from('categories').select('id,name').order('ordering'),
    ])
    setRows(p.data || [])
    setCats(c.data || [])
  }
  useEffect(() => {
    load()
  }, [])

  const edit = (p) => setF({ ...p, category_id: p.category_id || '', tagsText: (p.tags || []).join(', '), images: p.images || [] })

  const save = async (e) => {
    e.preventDefault()
    setErr('')
    const payload = {
      name: f.name.trim(),
      slug: f.slug.trim() || slugify(f.name),
      description: f.description || null,
      price: Math.max(0, Math.round(Number(f.price) || 0)),
      category_id: f.category_id || null,
      images: f.images,
      tags: f.tagsText.split(',').map((t) => t.trim()).filter(Boolean),
      badge: f.badge || null,
      is_active: f.is_active,
      is_featured: f.is_featured,
      ordering: Number(f.ordering) || 0,
    }
    const q = f.id ? supabase.from('products').update(payload).eq('id', f.id) : supabase.from('products').insert(payload)
    const { error } = await q
    if (error) return setErr(error.message.includes('duplicate') ? 'Slug đã tồn tại, hãy đổi slug.' : error.message)
    setF(null)
    load()
  }

  const remove = async (p) => {
    if (!confirm(`Xoá sản phẩm "${p.name}"?`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) return alert('Không xoá được (có thể đã có đơn hàng liên quan). Hãy tắt hiển thị thay vì xoá. ' + error.message)
    load()
  }

  const toggle = async (p, key) => {
    await supabase.from('products').update({ [key]: !p[key] }).eq('id', p.id)
    load()
  }

  return (
    <div>
      <div className="row between">
        <h1>Sản phẩm</h1>
        <button className="btn" onClick={() => setF({ ...EMPTY })}>
          + Thêm sản phẩm
        </button>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th />
            <th>Tên</th>
            <th>Danh mục</th>
            <th>Giá</th>
            <th>Hiện</th>
            <th>Nổi bật</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.images?.[0] ? <img className="mini" src={p.images[0]} alt="" /> : '☁️'}</td>
              <td>{p.name}</td>
              <td className="muted">{p.categories?.name || '—'}</td>
              <td>{vnd(p.price)}</td>
              <td>
                <button className="linkbtn" onClick={() => toggle(p, 'is_active')}>
                  {p.is_active ? '✓' : '—'}
                </button>
              </td>
              <td>
                <button className="linkbtn" onClick={() => toggle(p, 'is_featured')}>
                  {p.is_featured ? '★' : '☆'}
                </button>
              </td>
              <td className="right">
                <button className="linkbtn" onClick={() => edit(p)}>
                  Sửa
                </button>
                <button className="linkbtn danger" onClick={() => remove(p)}>
                  Xoá
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted">Chưa có sản phẩm. Bấm “Thêm sản phẩm” để bắt đầu.</p>}

      {f && (
        <div className="modal" onClick={() => setF(null)}>
          <form className="form wide" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3>{f.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h3>
            <label>
              Tên *
              <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </label>
            <label>
              Slug (để trống sẽ tự tạo)
              <input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder={slugify(f.name)} />
            </label>
            <div className="row">
              <label className="grow">
                Giá (VNĐ, 0 = liên hệ báo giá)
                <input type="number" min="0" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
              </label>
              <label className="grow">
                Danh mục
                <select value={f.category_id} onChange={(e) => setF({ ...f, category_id: e.target.value })}>
                  <option value="">— Không —</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Mô tả
              <textarea rows="4" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </label>
            <div>
              <div className="lbl">Ảnh (ảnh đầu tiên là ảnh đại diện)</div>
              <ImageUploader images={f.images} onChange={(images) => setF({ ...f, images })} />
            </div>
            <div className="row">
              <label className="grow">
                Thẻ (phân cách bằng dấu phẩy)
                <input value={f.tagsText} onChange={(e) => setF({ ...f, tagsText: e.target.value })} />
              </label>
              <label className="grow">
                Nhãn (vd: Mới, Bán chạy)
                <input value={f.badge || ''} onChange={(e) => setF({ ...f, badge: e.target.value })} />
              </label>
              <label>
                Thứ tự
                <input type="number" value={f.ordering} onChange={(e) => setF({ ...f, ordering: e.target.value })} />
              </label>
            </div>
            <div className="row">
              <label className="check">
                <input type="checkbox" checked={!!f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
                Hiển thị trên web
              </label>
              <label className="check">
                <input type="checkbox" checked={!!f.is_featured} onChange={(e) => setF({ ...f, is_featured: e.target.checked })} />
                Nổi bật ở trang chủ
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
