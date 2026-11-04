import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function OrderForm({ product, title = 'Đặt hàng' }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', address: '', quantity: 1, notes: '' })
  const [state, setState] = useState('idle')
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setState('sending')
    setErr('')
    const { error } = await supabase.from('orders').insert({
      customer_name: f.name.trim(),
      customer_phone: f.phone.trim(),
      customer_email: f.email.trim() || null,
      customer_address: f.address.trim() || null,
      product_id: product?.id || null,
      product_name: product?.name || 'Đặt riêng theo yêu cầu',
      quantity: Math.max(1, Number(f.quantity) || 1),
      notes: f.notes.trim() || null,
    })
    if (error) {
      setErr('Chưa gửi được. Vui lòng kiểm tra thông tin và thử lại.')
      setState('idle')
    } else {
      setState('done')
    }
  }

  if (state === 'done')
    return (
      <div className="form done">
        <h3>Cảm ơn bạn! 💙</h3>
        <p>InMây đã nhận được yêu cầu và sẽ liên hệ với bạn sớm nhất.</p>
      </div>
    )

  return (
    <form className="form" onSubmit={submit}>
      <h3>{title}</h3>
      <label>
        Họ tên *
        <input required maxLength={120} value={f.name} onChange={set('name')} />
      </label>
      <label>
        Số điện thoại *
        <input required minLength={6} maxLength={20} inputMode="tel" value={f.phone} onChange={set('phone')} />
      </label>
      <label>
        Email
        <input type="email" maxLength={200} value={f.email} onChange={set('email')} />
      </label>
      <label>
        Địa chỉ
        <input maxLength={500} value={f.address} onChange={set('address')} />
      </label>
      {product && (
        <label>
          Số lượng
          <input type="number" min="1" max="1000" value={f.quantity} onChange={set('quantity')} />
        </label>
      )}
      <label>
        {product ? 'Ghi chú (màu sắc, tên khắc, kích thước…)' : 'Bạn muốn InMây làm gì? *'}
        <textarea
          rows="4"
          maxLength={2000}
          required={!product}
          value={f.notes}
          onChange={set('notes')}
        />
      </label>
      {err && <p className="error">{err}</p>}
      <button className="btn" disabled={state === 'sending'}>
        {state === 'sending' ? 'Đang gửi…' : 'Gửi yêu cầu'}
      </button>
    </form>
  )
}
