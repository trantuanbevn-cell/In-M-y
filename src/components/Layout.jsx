import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useSettings } from './Settings.jsx'

const LABELS = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  shopee: 'Shopee',
  lazada: 'Lazada',
  tiki: 'Tiki',
  tiktokShop: 'TikTok Shop',
}

function LinkList({ title, data }) {
  const items = Object.entries(data || {}).filter(([, v]) => v)
  if (!items.length) return null
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {items.map(([k, v]) => (
          <li key={k}>
            <a href={v} target="_blank" rel="noreferrer">
              {LABELS[k] || k}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Layout() {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  const brand = settings.brand_name || 'InMây'
  const contact = settings.contact || {}

  return (
    <>
      <header className="header">
        <div className="container header-in">
          <Link to="/" className="brand">
            <span className="brand-cloud">☁️</span> {brand}
          </Link>
          <nav className="nav">
            <NavLink to="/san-pham">Sản phẩm</NavLink>
            <NavLink to="/bo-suu-tap">Bộ sưu tập</NavLink>
            <NavLink to="/dat-rieng" className="nav-cta">
              Đặt riêng
            </NavLink>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="footer">
        <div className="container footer-in">
          <div>
            <div className="brand">
              <span className="brand-cloud">☁️</span> {brand}
            </div>
            <p className="muted">{settings.sub_tagline}</p>
            {contact.phone && <p>📞 {contact.phone}</p>}
            {contact.email && <p>✉️ {contact.email}</p>}
            {contact.address && <p>📍 {contact.address}</p>}
          </div>
          <LinkList title="Mạng xã hội" data={settings.social} />
          <LinkList title="Mua trên sàn" data={settings.marketplaces} />
        </div>
        <div className="container copy">
          © {new Date().getFullYear()} {brand} · <Link to="/admin">Quản trị</Link>
        </div>
      </footer>
    </>
  )
}
