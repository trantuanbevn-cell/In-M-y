import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import ImageUploader from './ImageUploader.jsx'

const empty = { title: '', subtitle: '', image_url: '', link: '', cta_label: 'Xem ngay', starts_on: '', ends_on: '', is_active: true, ordering: 0 }

export default function AdminCampaigns() {
  const [rows, setRows] = useState([])
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    const { data, error } = await supabase.from('campaigns').select('*').order('ordering').order('created_at', { ascending: false })
    if (error) setErr(error.message)
    setRows(data || [])
  }
  useEffect(() => {
    load()
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setErr('')
    const row = { ...f, starts_on: f.starts_on || null, ends_on: f.ends_on || null, link: f.link || null, subtitle: f.subtitle || null }
    delete row.created_at
    const q = row.id ? supabase.from('campaigns').update(row).eq('id', row.id) : supabase.from('campaigns').insert(row)
    const { error } = await q
    if (error) return setErr(error.message)
    setF(null)
    load()
  }
  const remove = async (id) => {
    if (!confirm('Xoá banner này?')) return
    await supabase.from('campaigns').delete().eq('id', id)
    load()
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  if (f)
    return (
      <form className="form wide flat" onSubmit={save}>
        <h1>{f.id ? 'Sửa banner' : 'Banner sự kiện mới'}</h1>
        <label>Tiêu đề *<input required value={f.title} onChange={set('title')} placeholder="VD: Trung thu rực rỡ cùng InMây" /></label>
        <label>Dòng phụ<input value={f.subtitle || ''} onChange={set('subtitle')} /></label>
        <div>
          <b>Ảnh banner / tờ rơi / pano</b>
          <ImageUploader images={f.image_url ? [f.image_url] : []} multiple={false} onChange={(a) => setF({ ...f, image_url: a[0] || '' })} />
        </div>
        <label>Link khi bấm (VD: /san-pham hoặc /bo-suu-tap/trung-thu)<input value={f.link || ''} onChange={set('link')} /></label>
        <label>Chữ trên nút<input value={f.cta_label || ''} onChange={set('cta_label')} /></label>
        <div className="two">
          <label>Bắt đầu hiển thị<input type="date" value={f.starts_on || ''} onChange={set('starts_on')} /></label>
          <label>Kết thúc<input type="date" value={f.ends_on || ''} onChange={set('ends_on')} /></label>
        </div>
        <label className="row"><input type="checkbox" checked={f.is_active} onChange={set('is_active')} /> Đang bật</label>
        {err && <p className="error">{err}</p>}
        <div className="row">
          <button className="btn">Lưu</button>
          <button type="button" className="btn ghost" onClick={() => setF(null)}>Huỷ</button>
        </div>
      </form>
    )

  return (
    <div>
      <div className="row between">
        <h1>Banner sự kiện</h1>
        <button className="btn" onClick={() => setF({ ...empty })}>+ Thêm banner</button>
      </div>
      <p className="muted small">Banner hiện ở đầu trang chủ trong khoảng ngày bạn đặt. Hết ngày tự ẩn.</p>
      {err && <p className="error">{err}</p>}
      <table className="table">
        <thead><tr><th>Ảnh</th><th>Tiêu đề</th><th>Thời gian</th><th>Bật</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.image_url && <img src={r.image_url} alt="" style={{ width: 90, borderRadius: 6 }} />}</td>
              <td>{r.title}</td>
              <td>{r.starts_on || '…'} → {r.ends_on || '…'}</td>
              <td>{r.is_active ? '✓' : '—'}</td>
              <td className="row">
                <button className="chip" onClick={() => setF({ ...r })}>Sửa</button>
                <button className="chip" onClick={() => remove(r.id)}>Xoá</button>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="5" className="muted">Chưa có banner nào.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
