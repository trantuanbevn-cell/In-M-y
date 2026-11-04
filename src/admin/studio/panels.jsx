import { useEffect, useState } from 'react'
import { supabase } from '../../supabase.js'
import { INTERESTS } from '../../interests.js'
import { useZoom } from './Lightbox.jsx'

export const SPEC_FIELDS = { material: 'Chất liệu', size: 'Kích thước', weight: 'Trọng lượng', color: 'Màu sắc', make_time: 'Thời gian làm' }
export const LINK_FIELDS = { shopee: 'Shopee', tiktokShop: 'TikTok Shop', lazada: 'Lazada', facebook: 'Bài Facebook', tiki: 'Tiki' }

// Bảng khai báo thông tin sản phẩm
export function InfoPanel({ info, categories, onSave }) {
  const [f, setF] = useState(info || {})
  useEffect(() => setF(info || {}), [info])
  const commit = (next) => onSave(next)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const setIn = (g, k) => (e) => setF({ ...f, [g]: { ...(f[g] || {}), [k]: e.target.value } })
  const blur = () => commit(f)
  const price = Number(f.price) || 0
  const sale = Number(f.sale_price) || 0
  return (
    <div onBlur={blur}>
      <div className="two">
        <label>Tên sản phẩm *<input value={f.name || ''} onChange={set('name')} placeholder="VD: Đèn ngủ nấm thần tiên" /></label>
        <label>
          Danh mục
          <select value={f.category_id || ''} onChange={(e) => { const n = { ...f, category_id: e.target.value }; setF(n); commit(n) }}>
            <option value="">— Chưa chọn —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <div className="two">
        <label>Giá bán (đồng, để 0 nếu báo giá)<input inputMode="numeric" value={f.price ?? ''} onChange={set('price')} /></label>
        <label>Giá khuyến mãi (tuỳ chọn)<input inputMode="numeric" value={f.sale_price ?? ''} onChange={set('sale_price')} /></label>
      </div>
      {sale > 0 && price > 0 && sale >= price && <p className="error small">Giá khuyến mãi phải thấp hơn giá bán.</p>}
      <label>Mô tả ngắn<textarea rows="3" value={f.description || ''} onChange={set('description')} /></label>
      <div className="two">
        {Object.entries(SPEC_FIELDS).map(([k, label]) => (
          <label key={k}>{label}<input value={f.specs?.[k] || ''} onChange={setIn('specs', k)} /></label>
        ))}
        <label>Thẻ (cách nhau dấu phẩy)<input value={f.tags || ''} onChange={set('tags')} placeholder="đèn ngủ, quà tặng, trẻ em" /></label>
        <div>
          <span className="small">Thuộc sở thích nào trên web (bấm để thêm/bỏ thẻ)</span>
          <div className="chips">
            {INTERESTS.map((it) => {
              const list = String(f.tags || '').split(',').map((t) => t.trim()).filter(Boolean)
              const on = list.includes(it.slug)
              return (
                <button key={it.slug} type="button" className={'chip' + (on ? ' on' : '')} onClick={() => {
                  const next = { ...f, tags: (on ? list.filter((t) => t !== it.slug) : [...list, it.slug]).join(', ') }
                  setF(next)
                  commit(next)
                }}>{it.name}</button>
              )
            })}
          </div>
        </div>
        <label>Huy hiệu trên thẻ sản phẩm<input value={f.badge || ''} onChange={set('badge')} placeholder="VD: Mới, Độc bản" /></label>
      </div>
      <b className="small">Link bán trên các kênh (dán link sản phẩm)</b>
      <div className="two">
        {Object.entries(LINK_FIELDS).map(([k, label]) => (
          <label key={k}>{label}<input value={f.links?.[k] || ''} onChange={setIn('links', k)} placeholder="https://" /></label>
        ))}
      </div>
    </div>
  )
}

export const shrink = async (url, max = 1024) => {
  const blob = await (await fetch(url)).blob()
  const bmp = await createImageBitmap(blob)
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  const data = c.toDataURL('image/jpeg', 0.85).split(',')[1]
  return { mime: 'image/jpeg', data }
}

// AI nhìn ảnh và gợi ý cốt truyện
export function StoryPanel({ photos, info, story, onSave, onUseGuess, onPick }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [event, setEvent] = useState(story?.event || '')
  const [note, setNote] = useState(story?.note || '')
  const concepts = story?.concepts || []

  const run = async (more) => {
    setErr('')
    if (!photos.length) return setErr('Hãy tải ít nhất một ảnh chụp sản phẩm ở mục 2 trước.')
    setBusy(true)
    try {
      const images = await Promise.all(photos.slice(0, 3).map((a) => shrink(a.url)))
      const { data, error } = await supabase.functions.invoke('studio-story', {
        body: {
          images,
          info: { name: info?.name, description: info?.description, specs: info?.specs },
          event,
          note,
          avoid: more ? concepts.map((c) => c.title).join('; ') : '',
        },
      })
      if (error) {
        let m = error.message
        try { const j = await error.context.json(); m = j.message || j.error || m } catch {}
        throw new Error(m)
      }
      if (data?.error) throw new Error(data.message || data.error)
      const list = more ? [...concepts, ...data.concepts] : data.concepts
      onSave({ concepts: list, chosen: more ? story?.chosen ?? null : null, guess: data.product_guess, event, note, model: data.model })
    } catch (e) {
      setErr(e.message || String(e))
    }
    setBusy(false)
  }

  const g = story?.guess
  return (
    <div>
      <p className="muted small">
        AI sẽ nhìn ảnh thật của sản phẩm rồi đề xuất 3 cốt truyện khác nhau: bối cảnh, đạo cụ, ánh sáng, tiêu đề poster, ảnh góc, kịch bản video và lời đọc. Cốt truyện bạn chọn sẽ quyết định toàn bộ câu lệnh ở các bước sau.
      </p>
      <div className="two">
        <label>Dịp / chiến dịch (tuỳ chọn)<input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="VD: Trung thu, khai giảng, Noel" /></label>
        <label>Gợi ý thêm cho AI (tuỳ chọn)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: dành cho bé gái 6–10 tuổi, tông ấm" /></label>
      </div>
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => run(false)}>{busy ? 'AI đang xem ảnh…' : concepts.length ? '🔄 Gợi ý lại từ đầu' : '✨ AI gợi ý cốt truyện'}</button>
        {concepts.length > 0 && <button className="btn ghost" disabled={busy} onClick={() => run(true)}>+ Thêm 3 ý tưởng khác</button>}
      </div>
      {err && <p className="error">{err}</p>}
      {g && (
        <p className="small">
          AI nhận ra sản phẩm: <b>{g.name}</b>{g.material ? ` · ${g.material}` : ''}.{' '}
          <button className="linkbtn" onClick={() => onUseGuess(g)}>Điền vào thông tin còn trống</button>
        </p>
      )}
      <div className="concepts">
        {concepts.map((c, i) => (
          <div key={i} className={'concept' + (story.chosen === i ? ' on' : '')}>
            <h4>{i + 1}. {c.title}</h4>
            <p className="small">{c.story}</p>
            <p className="muted small"><b>Vì sao hợp:</b> {c.logic}</p>
            <p className="muted small"><b>Poster:</b> {c.poster_headline}{c.poster_tagline ? ` — ${c.poster_tagline}` : ''}</p>
            {c.events?.length > 0 && <p className="muted small"><b>Dịp phù hợp:</b> {c.events.join(', ')}</p>}
            <details>
              <summary className="small">Xem chi tiết bối cảnh, ảnh góc, video</summary>
              <p className="small"><b>Bối cảnh (cho AI vẽ):</b> {c.setting_en}</p>
              <p className="small"><b>Đạo cụ:</b> {(c.props_en || []).join(', ')}</p>
              <ul className="small">{(c.angle_shots || []).map((a, k) => <li key={k}>{a.label}</li>)}</ul>
              <ol className="small">{(c.storyboard || []).map((s, k) => <li key={k}>{s.shot}</li>)}</ol>
              <p className="small"><b>Lời đọc:</b> {c.voiceover}</p>
            </details>
            <button className={story.chosen === i ? 'btn' : 'btn ghost'} onClick={() => onPick(i)}>{story.chosen === i ? '✓ Đang dùng cốt truyện này' : 'Chọn cốt truyện này'}</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Gọi Edge Function và lấy thông báo lỗi dễ hiểu
export async function callFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let m = error.message
    try { const j = await error.context.json(); m = j.message || j.error || m } catch {}
    throw new Error(m)
  }
  if (data?.error) throw new Error(data.message || data.error)
  return data
}

const b64ToBlob = (b64, mime) => {
  const bin = atob(b64)
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return new Blob([u], { type: mime })
}

const RATIO_LIST = [['1:1', 1], ['4:5', 0.8], ['3:4', 0.75], ['2:3', 0.667], ['9:16', 0.5625], ['4:3', 1.333], ['16:9', 1.778]]
export const nearestRatio = (w, h) => (w && h ? RATIO_LIST.reduce((a, b) => (Math.abs(b[1] - w / h) < Math.abs(a[1] - w / h) ? b : a))[0] : '1:1')

// Làn tự động: bước 1 tạo 3 phương án poster, bạn chọn một, bước 2 tạo ảnh góc phụ dựa trên poster đã chọn
export function AutoGen({ photos, posterJobs, angleJobs, posters, chosenPoster, onPickPoster, aspect, onSaveImage }) {
  const zoom = useZoom()
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')

  const run = async (list, withPoster) => {
    setErr('')
    if (!photos.length) return setErr('Hãy tải ít nhất một ảnh chụp sản phẩm ở mục 2 trước.')
    if (withPoster && !chosenPoster) return setErr('Hãy chọn một phương án poster trước.')
    let left = list.length
    setBusy(`Đang tạo ${left} ảnh cùng lúc… (khoảng 20–40 giây)`)
    try {
      const shots = await Promise.all(photos.slice(0, withPoster ? 2 : 3).map((a) => shrink(a.url)))
      const refs = withPoster ? [await shrink(chosenPoster.url), ...shots] : shots
      const results = await Promise.allSettled(
        list.map(async (j) => {
          const out = await callFn('studio-image', { prompt: j.prompt, images: refs, aspect })
          const ext = out.mime.includes('jpeg') ? 'jpg' : 'png'
          const file = new File([b64ToBlob(out.data, out.mime)], `ai-${Date.now()}.${ext}`, { type: out.mime })
          await onSaveImage(j.kind, file)
          left -= 1
          setBusy(left ? `Còn ${left} ảnh đang tạo…` : '')
        }),
      )
      const bad = results.filter((r) => r.status === 'rejected')
      if (bad.length) setErr(`${bad.length}/${list.length} ảnh lỗi: ${bad[0].reason?.message || bad[0].reason}`)
    } catch (e) {
      setErr(e.message || String(e))
    }
    setBusy('')
  }

  const recent = posters.slice(-6)
  return (
    <div className="promptbox">
      <b>⚡ Tạo tự động bằng AI Gemini</b>
      <p className="muted small">AI nhìn ảnh chụp thật ở mục 2 rồi vẽ theo cốt truyện bạn chọn. Khoảng 1.700đ mỗi ảnh.</p>

      <div className="step">Bước 1 · Tạo 3 phương án poster rồi chọn một</div>
      <div className="row">
        <button className="btn" disabled={!!busy} onClick={() => run(posterJobs, false)}>Tạo 3 phương án poster</button>
        {posterJobs.map((j) => (
          <button key={j.label} className="btn ghost" disabled={!!busy} onClick={() => run([j], false)}>{j.label.replace('Phương án ', '')}</button>
        ))}
      </div>
      {recent.length > 0 && (
        <div className="pposters">
          {recent.map((a) => (
            <div key={a.id} className={'pposter' + (chosenPoster?.id === a.id ? ' on' : '')}>
              <img className="zoomable" src={a.url} alt="" onClick={() => zoom(recent.map((x) => ({ kind: 'image', url: x.url, caption: 'Poster' })), recent.indexOf(a))} />
              <button type="button" className={chosenPoster?.id === a.id ? 'btn' : 'btn ghost'} onClick={() => onPickPoster(a)}>
                {chosenPoster?.id === a.id ? '✓ Đã chọn' : 'Chọn'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="step">Bước 2 · Tạo ảnh góc phụ (dựa trên poster đã chọn)</div>
      {!chosenPoster && <p className="muted small">Chọn một poster ở bước 1 để mở khoá bước này.</p>}
      <div className="row">
        {angleJobs.map((j) => (
          <button key={j.label} className="btn ghost" disabled={!!busy || !chosenPoster} onClick={() => run([j], true)}>{j.label}</button>
        ))}
        <button className="btn" disabled={!!busy || !chosenPoster} onClick={() => run(angleJobs, true)}>Tạo cả {angleJobs.length} ảnh phụ</button>
      </div>
      {busy && <p className="note">{busy}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  )
}
