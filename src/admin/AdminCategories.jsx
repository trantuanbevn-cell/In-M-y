import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { slugify } from '../lib.js'

const EMPTY = { name: '', slug: '', description: '', icon: '', ordering: 0, is_active: true }

export default function AdminCategories() {
  const [rows, setRows] = useState([])
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    const { data } = await supabase.from('categories').select('*').order('ordering')
    setRows(data || [])
  }
  useEffect(() => {
    load()
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setErr('')
    const payload = {
      name: f.name.trim(),
      slug: f.slug.trim() || slugify(f.name),
      description: f.description || null,
      icon: f.icon || null,
      ordering: Number(f.ordering) || 0,
      is_active: f.is_active,
    }
    const q = f.id ? supabase.from('categories').update(payload).eq('id', f.id) : supabase.from('categories').insert(payload)
    const { error } = await q
    if (error) return setErr(error.message)
    setF(null)
    load()
  }

  const remove = async (c) => {
    if (!confirm(`Xoá danh mục "${c.name}"?`)) return
    const { error } = await supabase.from('categories').delete().eq('id', c.id)
    if (error) return alert('Không xoá được (có thể còn sản phẩm thuộc danh mục): ' + error.message)
    load()
  }

  return (
    <div>
      <div className="row between">
        <h1>Danh mục</h1>
        <button className="btn" onClick={() => setF({ ...EMPTY })}>
          + Thêm danh mục
        </button>
      </div>
      <table className="tbl">
        <thead>
          <tr>
            <th>Biểu tượng</th>
            <th>Tên</th>
            <th>Slug</th>
            <th>Thứ tự</th>
            <th>Hiện</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{c.icon}</td>
              <td>{c.name}</td>
              <td className="muted">{c.slug}</td>
              <td>{c.ordering}</td>
              <td>{c.is_active ? '✓' : '—'}</td>
              <td className="right">
                <button className="linkbtn" onClick={() => setF(c)}>
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
      {rows.length === 0 && <p className="muted">Chưa có danh mục.</p>}

      {f && (
        <div className="modal" onClick={() => setF(null)}>
          <form className="form" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3>{f.id ? 'Sửa danh mục' : 'Thêm danh mục'}</h3>
            <label>
              Tên *
              <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </label>
            <label>
              Slug (để trống sẽ tự tạo)
              <input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder={slugify(f.name)} />
            </label>
            <label>
              Biểu tượng (emoji)
              <input value={f.icon || ''} onChange={(e) => setF({ ...f, icon: e.target.value })} />
            </label>
            <label>
              Mô tả
              <textarea rows="2" value={f.description || ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
            </label>
            <label>
              Thứ tự
              <input type="number" value={f.ordering} onChange={(e) => setF({ ...f, ordering: e.target.value })} />
            </label>
            <label className="check">
              <input type="checkbox" checked={!!f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
              Hiển thị trên web
            </label>
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
