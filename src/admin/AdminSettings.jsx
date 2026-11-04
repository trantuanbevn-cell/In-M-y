import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { useSettings } from '../components/Settings.jsx'

const GROUPS = [
  { key: 'contact', title: 'Thông tin liên hệ', fields: { phone: 'Điện thoại', zalo: 'Zalo (số điện thoại hoặc link zalo.me/…)', messenger: 'Messenger (link m.me/tên-trang)', email: 'Email', address: 'Địa chỉ' } },
  {
    key: 'social',
    title: 'Mạng xã hội (dán link đầy đủ)',
    fields: { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' },
  },
  {
    key: 'marketplaces',
    title: 'Sàn thương mại điện tử (dán link gian hàng)',
    fields: { shopee: 'Shopee', lazada: 'Lazada', tiki: 'Tiki', tiktokShop: 'TikTok Shop' },
  },
]
const TEXTS = { brand_name: 'Tên thương hiệu', tagline: 'Slogan chính', sub_tagline: 'Slogan phụ', closing_message: 'Thông điệp cuối trang' }

export default function AdminSettings() {
  const { settings, reload } = useSettings()
  const [s, setS] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!Object.keys(settings).length) return
    setS({
      ...settings,
      story: { title: '', body: [], ...(settings.story || {}) },
    })
  }, [settings])

  if (!s) return <p className="muted">Đang tải…</p>

  const save = async (e) => {
    e.preventDefault()
    setMsg('')
    const rows = Object.entries(s).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }))
    const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' })
    if (error) return setMsg('Lỗi: ' + error.message)
    await reload()
    setMsg('Đã lưu ✓')
  }

  const setGroup = (g, k, v) => setS({ ...s, [g]: { ...(s[g] || {}), [k]: v } })

  return (
    <form className="form wide flat" onSubmit={save}>
      <h1>Cài đặt</h1>
      {Object.entries(TEXTS).map(([k, label]) => (
        <label key={k}>
          {label}
          <input value={s[k] || ''} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
        </label>
      ))}

      <fieldset>
        <legend>Câu chuyện thương hiệu</legend>
        <label>
          Tiêu đề
          <input value={s.story.title} onChange={(e) => setS({ ...s, story: { ...s.story, title: e.target.value } })} />
        </label>
        <label>
          Nội dung (mỗi đoạn một dòng)
          <textarea
            rows="6"
            value={(s.story.body || []).join('\n')}
            onChange={(e) => setS({ ...s, story: { ...s.story, body: e.target.value.split('\n') } })}
          />
        </label>
      </fieldset>

      {GROUPS.map((g) => (
        <fieldset key={g.key}>
          <legend>{g.title}</legend>
          {Object.entries(g.fields).map(([k, label]) => (
            <label key={k}>
              {label}
              <input value={s[g.key]?.[k] || ''} onChange={(e) => setGroup(g.key, k, e.target.value)} />
            </label>
          ))}
        </fieldset>
      ))}

      <div className="row">
        <button className="btn">Lưu cài đặt</button>
        {msg && <span className={msg.startsWith('Lỗi') ? 'error' : 'muted'}>{msg}</span>}
      </div>
    </form>
  )
}
