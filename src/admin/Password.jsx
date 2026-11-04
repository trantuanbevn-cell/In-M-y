import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function Password() {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [msg, setMsg] = useState('')
  const [bad, setBad] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setMsg('')
    if (p1.length < 8) {
      setBad(true)
      return setMsg('Mật khẩu cần ít nhất 8 ký tự.')
    }
    if (p1 !== p2) {
      setBad(true)
      return setMsg('Hai mật khẩu chưa giống nhau.')
    }
    const { error } = await supabase.auth.updateUser({ password: p1 })
    setBad(!!error)
    setMsg(error ? 'Lỗi: ' + error.message : 'Đã đổi mật khẩu ✓')
    if (!error) {
      setP1('')
      setP2('')
    }
  }

  return (
    <form className="form flat" onSubmit={submit}>
      <h1>Đổi mật khẩu</h1>
      <label>
        Mật khẩu mới
        <input type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} />
      </label>
      <label>
        Nhập lại mật khẩu mới
        <input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
      </label>
      <div className="row">
        <button className="btn">Lưu mật khẩu</button>
        {msg && <span className={bad ? 'error' : 'muted'}>{msg}</span>}
      </div>
    </form>
  )
}
