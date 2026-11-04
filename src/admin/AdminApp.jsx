import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, Link } from 'react-router-dom'
import { supabase } from '../supabase.js'
import Orders from './Orders.jsx'
import AdminProducts from './AdminProducts.jsx'
import AdminCategories from './AdminCategories.jsx'
import AdminCollections from './AdminCollections.jsx'
import AdminSettings from './AdminSettings.jsx'
import Password from './Password.jsx'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setErr('Email hoặc mật khẩu không đúng.')
    setBusy(false)
  }

  return (
    <div className="login">
      <form className="form" onSubmit={submit}>
        <h2>☁️ InMây · Quản trị</h2>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Mật khẩu
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {err && <p className="error">{err}</p>}
        <button className="btn" disabled={busy}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        <p className="muted small">
          <Link to="/">← Về trang chủ</Link>
        </p>
      </form>
    </div>
  )
}

export default function AdminApp() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return setRole(undefined)
    supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => setRole(data?.role || 'none'))
  }, [session])

  if (session === undefined) return <div className="container section muted">Đang tải…</div>
  if (!session) return <Login />
  if (role === undefined) return <div className="container section muted">Đang tải…</div>

  if (role !== 'admin' && role !== 'owner')
    return (
      <div className="login">
        <div className="form">
          <h2>Chưa có quyền quản trị</h2>
          <p>
            Tài khoản <b>{session.user.email}</b> chưa được cấp quyền. Hãy nhờ chủ shop cấp quyền admin cho tài khoản
            này.
          </p>
          <button className="btn ghost" onClick={() => supabase.auth.signOut()}>
            Đăng xuất
          </button>
        </div>
      </div>
    )

  return (
    <div className="admin">
      <aside className="side">
        <div className="brand">☁️ InMây</div>
        <NavLink to="/admin" end>
          Đơn hàng
        </NavLink>
        <NavLink to="/admin/san-pham">Sản phẩm</NavLink>
        <NavLink to="/admin/danh-muc">Danh mục</NavLink>
        <NavLink to="/admin/bo-suu-tap">Bộ sưu tập</NavLink>
        <NavLink to="/admin/cai-dat">Cài đặt</NavLink>
        <NavLink to="/admin/mat-khau">Đổi mật khẩu</NavLink>
        <div className="grow" />
        <Link to="/" target="_blank">
          Xem trang web ↗
        </Link>
        <button className="linkbtn" onClick={() => supabase.auth.signOut()}>
          Đăng xuất
        </button>
      </aside>
      <section className="adm-main">
        <Routes>
          <Route index element={<Orders />} />
          <Route path="san-pham" element={<AdminProducts />} />
          <Route path="danh-muc" element={<AdminCategories />} />
          <Route path="bo-suu-tap" element={<AdminCollections />} />
          <Route path="cai-dat" element={<AdminSettings />} />
          <Route path="mat-khau" element={<Password />} />
        </Routes>
      </section>
    </div>
  )
}
