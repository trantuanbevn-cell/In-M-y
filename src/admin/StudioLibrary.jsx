import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { KINDS } from './studio/prompts.js'

const HINT = {
  badge: 'Nội dung chữ sẽ hiện trên poster',
  cta: 'Nội dung chữ trên nút/dải kêu gọi',
  ratio: 'Ô “Mô tả” là tỉ lệ, ví dụ 9:16',
}

export default function StudioLibrary() {
  const [rows, setRows] = useState([])
  const [kind, setKind] = useState(KINDS[0].kind)
  const [f, setF] = useState(null)
  const [err, setErr] = useState('')

  const load = async () => {
    const { data } = await supabase.from('studio_options').select('*').order('ordering').order('created_at')
    setRows(data || [])
  }
  useEffect(() => {
    load()
  }, [])

  const list = rows.filter((r) => r.kind === kind)
  const meta = KINDS.find((k) => k.kind === kind)

  const save = async (e) => {
    e.preventDefault()
    setErr('')
    let metaJson = {}
    try {
      metaJson = f.metaText?.trim() ? JSON.parse(f.metaText) : {}
    } catch {
      return setErr('Phần “Tham số kỹ thuật” phải là JSON hợp lệ, ví dụ {"ffmpeg":"zoom_in"}.')
    }
    const payload = {
      kind,
      label: f.label.trim(),
      prompt: f.prompt.trim(),
      meta: metaJson,
      ordering: Number(f.ordering) || 0,
      is_active: f.is_active,
    }
    const q = f.id ? supabase.from('studio_options').update(payload).eq('id', f.id) : supabase.from('studio_options').insert(payload)
    const { error } = await q
    if (error) return setErr(error.message)
    setF(null)
    load()
  }

  const del = async (r) => {
    if (!confirm(`Xoá lựa chọn “${r.label}”?`)) return
    await supabase.from('studio_options').delete().eq('id', r.id)
    load()
  }

  return (
    <div>
      <p className="muted small">
        <Link to="/admin/studio">← Studio</Link>
      </p>
      <div className="row between">
        <h1>Thư viện lựa chọn</h1>
        <button
          className="btn"
          onClick={() =>
            setF({ label: '', prompt: '', metaText: '', ordering: list.length + 1, is_active: true })
          }
        >
          + Thêm lựa chọn
        </button>
      </div>
      <p className="muted">
        Mỗi lựa chọn là một đoạn mô tả viết sẵn. Khi bạn tích chọn trong dự án, Studio ghép các đoạn này thành câu lệnh
        hoàn chỉnh. Bạn sửa, thêm, xoá thoải mái.
      </p>

      <div className="chips">
        {KINDS.map((k) => (
          <button key={k.kind} className={'chip' + (kind === k.kind ? ' on' : '')} onClick={() => setKind(k.kind)}>
            {k.label}
          </button>
        ))}
      </div>
      {HINT[kind] && <p className="muted small">{HINT[kind]}</p>}

      <table className="tbl">
        <thead>
          <tr>
            <th>Tên hiển thị</th>
            <th>Mô tả đưa vào câu lệnh</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.5 }}>
              <td>
                <b>{r.label}</b>
              </td>
              <td className="small">{r.prompt}</td>
              <td className="nowrap">
                <button
                  className="linkbtn"
                  onClick={() => setF({ ...r, metaText: Object.keys(r.meta || {}).length ? JSON.stringify(r.meta) : '' })}
                >
                  Sửa
                </button>{' '}
                <button className="linkbtn" onClick={() => del(r)}>
                  Xoá
                </button>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan="3" className="muted">
                Chưa có lựa chọn nào trong mục này.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {f && (
        <div className="modal" onClick={() => setF(null)}>
          <form className="form wide" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h3>
              {f.id ? 'Sửa' : 'Thêm'} · {meta.label}
            </h3>
            <label>
              Tên hiển thị
              <input required value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
            </label>
            <label>
              Mô tả đưa vào câu lệnh (tiếng Anh cho ảnh/video thường cho kết quả tốt hơn)
              <textarea rows="3" value={f.prompt} onChange={(e) => setF({ ...f, prompt: e.target.value })} />
            </label>
            <label>
              Tham số kỹ thuật (JSON, tuỳ chọn)
              <input
                value={f.metaText || ''}
                onChange={(e) => setF({ ...f, metaText: e.target.value })}
                placeholder='VD: {"ffmpeg":"zoom_in"} hoặc {"w":1080,"h":1920}'
              />
            </label>
            <label>
              Thứ tự
              <input type="number" value={f.ordering} onChange={(e) => setF({ ...f, ordering: e.target.value })} />
            </label>
            <label className="check">
              <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} />
              Đang dùng
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
