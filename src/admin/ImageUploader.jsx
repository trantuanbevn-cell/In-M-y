import { useState } from 'react'
import { supabase, BUCKET } from '../supabase.js'

// images: mảng URL công khai. onChange(mảng mới)
export default function ImageUploader({ images, onChange, multiple = true }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const upload = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    setErr('')
    const urls = []
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
      if (error) {
        setErr(error.message)
        continue
      }
      urls.push(supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl)
    }
    setBusy(false)
    if (urls.length) onChange(multiple ? [...images, ...urls] : [urls[0]])
  }

  return (
    <div>
      <div className="thumbs admin-thumbs">
        {images.map((u, i) => (
          <div key={u} className="thumb-wrap">
            <img src={u} alt="" />
            <div className="thumb-actions">
              {i > 0 && (
                <button type="button" title="Đưa lên đầu" onClick={() => onChange([u, ...images.filter((x) => x !== u)])}>
                  ★
                </button>
              )}
              <button type="button" title="Xoá ảnh" onClick={() => onChange(images.filter((x) => x !== u))}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple={multiple} onChange={upload} disabled={busy} />
      {busy && <span className="muted"> Đang tải ảnh…</span>}
      {err && <p className="error">{err}</p>}
    </div>
  )
}
