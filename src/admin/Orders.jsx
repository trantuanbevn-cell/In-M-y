import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { STATUS, fmtDate } from '../lib.js'

export default function Orders() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('')
  const [err, setErr] = useState('')

  const load = async () => {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false })
    if (error) setErr(error.message)
    setRows(data || [])
  }
  useEffect(() => {
    load()
  }, [])

  const update = async (id, patch) => {
    const { error } = await supabase.from('orders').update(patch).eq('id', id)
    if (error) return alert('Không lưu được: ' + error.message)
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  }

  const remove = async (id) => {
    if (!confirm('Xoá đơn này?')) return
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) return alert(error.message)
    setRows((r) => r.filter((x) => x.id !== id))
  }

  const shown = rows.filter((r) => !filter || r.status === filter)
  const count = (s) => rows.filter((r) => r.status === s).length

  return (
    <div>
      <h1>Đơn hàng</h1>
      {err && <p className="error">{err}</p>}
      <div className="chips">
        <button className={'chip' + (!filter ? ' on' : '')} onClick={() => setFilter('')}>
          Tất cả ({rows.length})
        </button>
        {Object.entries(STATUS).map(([k, v]) => (
          <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
            {v} ({count(k)})
          </button>
        ))}
      </div>
      {shown.length === 0 && <p className="muted">Chưa có đơn nào.</p>}
      {shown.map((o) => (
        <div key={o.id} className="order">
          <div className="order-head">
            <b>{o.customer_name}</b> · <a href={`tel:${o.customer_phone}`}>{o.customer_phone}</a>
            <span className="muted"> · {fmtDate(o.created_at)}</span>
            <span className={'st st-' + o.status}>{STATUS[o.status]}</span>
          </div>
          <p>
            <b>{o.product_name}</b> × {o.quantity}
          </p>
          {o.customer_email && <p className="muted small">✉️ {o.customer_email}</p>}
          {o.customer_address && <p className="muted small">📍 {o.customer_address}</p>}
          {o.notes && <p className="note">“{o.notes}”</p>}
          <div className="row">
            <select value={o.status} onChange={(e) => update(o.id, { status: e.target.value })}>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              className="grow"
              placeholder="Ghi chú nội bộ…"
              defaultValue={o.admin_notes || ''}
              onBlur={(e) => e.target.value !== (o.admin_notes || '') && update(o.id, { admin_notes: e.target.value })}
            />
            <button className="linkbtn danger" onClick={() => remove(o.id)}>
              Xoá
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
