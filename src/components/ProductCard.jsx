import { Link } from 'react-router-dom'
import { vnd } from '../lib.js'

export default function ProductCard({ p }) {
  const img = p.images?.[0]
  return (
    <Link to={`/san-pham/${p.slug}`} className="card">
      <div className="card-img">
        {img ? <img src={img} alt={p.name} loading="lazy" /> : <span className="ph">☁️</span>}
        {p.badge && <span className="badge">{p.badge}</span>}
      </div>
      <div className="card-body">
        <h3>{p.name}</h3>
        <p className="price">{p.price > 0 ? vnd(p.price) : 'Liên hệ báo giá'}</p>
      </div>
    </Link>
  )
}
