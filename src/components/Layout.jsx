import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useSettings } from './Settings.jsx'
import '../site.css'

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

// Đám mây xếp lớp như vật in 3D
export function CloudMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="cloudmark">
      <g fill="currentColor">
        <rect x="14" y="6" width="14" height="5" rx="2.5" />
        <rect x="8" y="12" width="26" height="5" rx="2.5" opacity=".86" />
        <rect x="4" y="18" width="32" height="5" rx="2.5" opacity=".72" />
        <rect x="6" y="24" width="28" height="5" rx="2.5" opacity=".58" />
        <rect x="11" y="30" width="18" height="5" rx="2.5" opacity=".44" />
      </g>
    </svg>
  )
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

function ContactWidget({ contact, social }) {
  const [open, setOpen] = useState(false)
  const zalo = contact.zalo ? (/^https?:/.test(contact.zalo) ? contact.zalo : `https://zalo.me/${contact.zalo.replace(/\D/g, '')}`) : ''
  const mess = contact.messenger || (social?.facebook && /facebook\.com\//.test(social.facebook) ? social.facebook.replace('facebook.com/', 'm.me/') : '')
  const items = [
    zalo && { href: zalo, label: 'Chat Zalo', cls: 'zalo', icon: 'Z' },
    mess && { href: mess, label: 'Messenger', cls: 'mess', icon: 'M' },
    contact.phone && { href: `tel:${contact.phone.replace(/\s/g, '')}`, label: 'Gọi ngay', cls: 'call', icon: '☎' },
  ].filter(Boolean)
  if (!items.length) return null
  return (
    <div className="chatw">
      {open &&
        items.map((i) => (
          <a key={i.cls} className={'chatw-item ' + i.cls} href={i.href} target={i.href.startsWith('tel') ? undefined : '_blank'} rel="noreferrer">
            <span className="ic">{i.icon}</span> {i.label}
          </a>
        ))}
      <button className="chatw-btn" onClick={() => setOpen(!open)} aria-label={open ? 'Đóng liên hệ' : 'Liên hệ InMây'}>
        {open ? '✕' : 'Chat'}
      </button>
    </div>
  )
}

const Ico = {
  home: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  dream: <path d="M12 3l2.2 5.3L20 9l-4.3 3.8L17 19l-5-3-5 3 1.3-6.2L4 9l5.8-.7z" />,
  cal: <path d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 5h15M8 3v4m8-4v4" />,
  pen: <path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3" />,
}
function Tab({ to, end, icon, children }) {
  return (
    <NavLink to={to} end={end} className="tab">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
        {Ico[icon]}
      </svg>
      <span>{children}</span>
    </NavLink>
  )
}

export default function Layout() {
  const { settings } = useSettings()
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  const brand = settings.brand_name || 'InMây'
  const contact = settings.contact || {}

  return (
    <div className="site">
      <header className="header">
        <div className="container header-in">
          <Link to="/" className="brand">
            <CloudMark /> {brand}
          </Link>
          <nav className="nav">
            <NavLink to="/san-pham">Theo sở thích</NavLink>
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
      <ContactWidget contact={contact} social={settings.social} />
      <footer className="footer">
        <div className="container footer-in">
          <div>
            <div className="brand">
              <CloudMark size={26} /> {brand}
            </div>
            <p className="muted">{settings.sub_tagline}</p>
            {contact.phone && <p>Điện thoại: {contact.phone}</p>}
            {contact.zalo && <p>Zalo: {contact.zalo}</p>}
            {contact.email && <p>Email: {contact.email}</p>}
            {contact.address && <p>Địa chỉ: {contact.address}</p>}
          </div>
          <LinkList title="Mạng xã hội" data={settings.social} />
          <LinkList title="Mua trên sàn" data={settings.marketplaces} />
        </div>
        <div className="container copy">
          © {new Date().getFullYear()} {brand} · <Link to="/admin">Quản trị</Link>
        </div>
      </footer>
      <nav className="tabbar" aria-label="Điều hướng nhanh">
        <Tab to="/" end icon="home">Trang chủ</Tab>
        <Tab to="/san-pham" icon="dream">Sở thích</Tab>
        <Tab to="/bo-suu-tap" icon="cal">Dịp lễ</Tab>
        <Tab to="/dat-rieng" icon="pen">Đặt riêng</Tab>
      </nav>
    </div>
  )
}
