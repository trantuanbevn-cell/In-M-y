import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="container section center">
      <h1>Không tìm thấy trang</h1>
      <p className="muted">Có vẻ đám mây này đã bay đi mất rồi ☁️</p>
      <Link to="/" className="btn">
        Về trang chủ
      </Link>
    </div>
  )
}
