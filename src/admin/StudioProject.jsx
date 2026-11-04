import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { KINDS, buildPrompts, chosenConcept, extractCaptions, picked, scriptFromConcept } from './studio/prompts.js'
import { AutoGen, InfoPanel, StoryPanel, nearestRatio } from './studio/panels.jsx'
import { slugify } from '../lib.js'
import { copyText, downloadUrl, removeStudioFile, uploadStudioFile } from './studio/media.js'
import { renderSlideshow } from './studio/renderVideo.js'

const STATUS = { draft: 'Nháp', review: 'Chờ duyệt', approved: 'Đã duyệt', published: 'Đã đăng' }
const KIND_LABEL = { photo: 'Ảnh chụp', poster: 'Poster', angle: 'Ảnh góc phụ', video: 'Video', audio: 'Nhạc' }
const ACCEPT = {
  photo: 'image/png,image/jpeg,image/webp',
  poster: 'image/png,image/jpeg,image/webp',
  angle: 'image/png,image/jpeg,image/webp',
  video: 'video/mp4,video/webm',
  audio: 'audio/mpeg,audio/mp4,audio/wav',
}

function CopyBox({ title, text, hint }) {
  const [ok, setOk] = useState(false)
  return (
    <div className="promptbox">
      <div className="row between">
        <b>{title}</b>
        <button
          type="button"
          className="chip"
          onClick={async () => {
            setOk(await copyText(text))
            setTimeout(() => setOk(false), 1500)
          }}
        >
          {ok ? '✓ Đã sao chép' : 'Sao chép'}
        </button>
      </div>
      {hint && <p className="muted small">{hint}</p>}
      <pre>{text}</pre>
    </div>
  )
}

function AssetPreview({ a }) {
  if (a.kind === 'video') return <video src={a.url} controls preload="metadata" />
  if (a.kind === 'audio') return <audio src={a.url} controls />
  return <img src={a.url} alt="" />
}

export default function StudioProject() {
  const { id } = useParams()
  const [p, setP] = useState(null)
  const [assets, setAssets] = useState([])
  const [options, setOptions] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    const [pr, as, op, pd, ct] = await Promise.all([
      supabase.from('studio_projects').select('*').eq('id', id).maybeSingle(),
      supabase.from('studio_assets').select('*').eq('project_id', id).order('created_at'),
      supabase.from('studio_options').select('*').eq('is_active', true).order('ordering'),
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('id,name').order('ordering'),
    ])
    setP(pr.data || null)
    setAssets(as.data || [])
    setOptions(op.data || [])
    setProducts(pd.data || [])
    setCategories(ct.data || [])
    setLoaded(true)
  }
  useEffect(() => {
    load()
  }, [id])

  const product = useMemo(() => products.find((x) => x.id === p?.product_id), [products, p])
  const prompts = useMemo(() => (p ? buildPrompts({ project: p, product, options }) : null), [p, product, options])

  if (!loaded) return <p className="muted">Đang tải…</p>
  if (!p) return <p>Không tìm thấy dự án. <Link to="/admin/studio">← Studio</Link></p>

  const patch = async (fields) => {
    setP((cur) => ({ ...cur, ...fields }))
    const { error } = await supabase.from('studio_projects').update(fields).eq('id', id)
    if (error) setErr(error.message)
  }

  const toggle = (kind, optId, multi) => {
    const cur = p.selections?.[kind] || []
    const next = multi ? (cur.includes(optId) ? cur.filter((x) => x !== optId) : [...cur, optId]) : cur.includes(optId) ? [] : [optId]
    patch({ selections: { ...(p.selections || {}), [kind]: next } })
  }

  const upload = async (kind, files) => {
    setErr('')
    setBusy(`Đang tải ${KIND_LABEL[kind].toLowerCase()}…`)
    for (const file of files) {
      try {
        const { path, url } = await uploadStudioFile(file, `${id}/${kind}`)
        const { error } = await supabase.from('studio_assets').insert({ project_id: id, kind, url, storage_path: path })
        if (error) throw error
      } catch (e) {
        setErr(e.message || String(e))
      }
    }
    setBusy('')
    load()
  }

  const setApproved = async (a, approved) => {
    setAssets((cur) => cur.map((x) => (x.id === a.id ? { ...x, approved } : x)))
    await supabase.from('studio_assets').update({ approved }).eq('id', a.id)
  }

  const removeAsset = async (a) => {
    if (!confirm('Xoá tệp này khỏi dự án?')) return
    await removeStudioFile(a.storage_path)
    await supabase.from('studio_assets').delete().eq('id', a.id)
    load()
  }

  const linkProduct = async (pid) => {
    const x = products.find((q) => q.id === pid)
    const fields = { product_id: pid || null }
    if (x && !p.info?.name) {
      fields.info = {
        name: x.name,
        category_id: x.category_id || '',
        price: x.price || '',
        sale_price: x.sale_price || '',
        description: x.description || '',
        specs: x.specs || {},
        tags: (x.tags || []).join(', '),
        badge: x.badge || '',
        links: x.links || {},
      }
    }
    await patch(fields)
  }

  const useGuess = (g) => {
    const cur = p.info || {}
    patch({
      info: {
        ...cur,
        name: cur.name || g.name,
        description: cur.description || g.description,
        specs: { ...(cur.specs || {}), material: cur.specs?.material || g.material || '' },
        tags: cur.tags || (g.tags || []).join(', '),
        category_id: cur.category_id || categories.find((c) => g.category && c.name.toLowerCase().includes(g.category.toLowerCase()))?.id || '',
      },
    })
  }

  const pickConcept = (i) => {
    const st = { ...(p.story || {}), chosen: p.story?.chosen === i ? null : i }
    const c = st.concepts?.[i]
    const fields = { story: st }
    if (st.chosen !== null && c) {
      if (!(p.script || '').trim()) fields.script = scriptFromConcept(c)
      else if (confirm('Thay kịch bản hiện có bằng kịch bản của cốt truyện này?')) fields.script = scriptFromConcept(c)
    }
    patch(fields)
  }

  const concept = chosenConcept(p)
  const ratioMeta = picked(p.selections, options, 'ratio')[0]?.meta

  const publish = async () => {
    setErr('')
    setMsg('')
    const info = p.info || {}
    if (!info.name?.trim()) return setErr('Hãy điền Tên sản phẩm ở bước 1.')
    const price = Number(String(info.price || 0).replace(/\D/g, '')) || 0
    const sale = Number(String(info.sale_price || 0).replace(/\D/g, '')) || 0
    if (sale && price && sale >= price) return setErr('Giá khuyến mãi phải thấp hơn giá bán.')
    const imgs = assets.filter((a) => a.approved && (a.kind === 'poster' || a.kind === 'angle'))
    const vid = assets.filter((a) => a.approved && a.kind === 'video').pop()
    const base = assets.filter((a) => a.kind === 'photo').map((a) => a.url)
    if (!imgs.length && !vid && !product) return setErr('Chưa tích “Dùng” cho poster, ảnh góc hoặc video nào.')
    const urls = [...imgs.filter((a) => a.kind === 'poster'), ...imgs.filter((a) => a.kind === 'angle')].map((a) => a.url)
    const cleanLinks = Object.fromEntries(Object.entries(info.links || {}).filter(([, v]) => v && String(v).trim()))
    const fields = {
      name: info.name.trim(),
      description: info.description?.trim() || null,
      price,
      sale_price: sale || null,
      category_id: info.category_id || null,
      specs: Object.fromEntries(Object.entries(info.specs || {}).filter(([, v]) => v && String(v).trim())),
      links: cleanLinks,
      tags: String(info.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
      badge: info.badge?.trim() || null,
      story: concept?.page_story || product?.story || null,
    }
    let pid = product?.id
    if (product) {
      const merged = [...urls, ...(product.images || []).filter((u) => !urls.includes(u))]
      const { error } = await supabase
        .from('products')
        .update({ ...fields, images: merged, video_url: vid ? vid.url : product.video_url || null })
        .eq('id', pid)
      if (error) return setErr(error.message)
    } else {
      const slug = `${slugify(fields.name)}-${Math.random().toString(36).slice(2, 6)}`
      const { data, error } = await supabase
        .from('products')
        .insert({ ...fields, slug, images: [...urls, ...base.filter((u) => !urls.includes(u))], video_url: vid ? vid.url : null, is_active: true })
        .select('id')
        .single()
      if (error) return setErr(error.message)
      pid = data.id
    }
    await patch({ status: 'published', product_id: pid })
    setMsg(product ? 'Đã cập nhật sản phẩm trên web: giá, link, ảnh và video.' : 'Đã tạo sản phẩm mới và đăng lên web. Khách xem và đặt hàng được ngay.')
    load()
  }

  const makeBanner = async () => {
    setErr('')
    const poster = assets.filter((a) => a.approved && a.kind === 'poster').pop()
    if (!poster) return setErr('Hãy tích “Dùng” cho một poster trước.')
    const { error } = await supabase.from('campaigns').insert({
      title: p.poster_title || concept?.poster_headline || p.info?.name || p.title,
      subtitle: concept?.poster_tagline || null,
      image_url: poster.url,
      link: product ? `/san-pham/${product.slug}` : '/san-pham',
      cta_label: 'Xem ngay',
      is_active: false,
    })
    if (error) return setErr(error.message)
    setMsg('Đã tạo banner (đang tắt). Vào mục “Banner sự kiện” để đặt ngày và bật.')
  }

  const approvedFiles = assets.filter((a) => a.approved)

  return (
    <div className="studio-proj">
      <p className="muted small">
        <Link to="/admin/studio">← Studio</Link>
      </p>
      <div className="row between">
        <h1>{p.title}</h1>
        <label className="row">
          Trạng thái
          <select value={p.status} onChange={(e) => patch({ status: e.target.value })}>
            {Object.entries(STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      {busy && <p className="note">{busy}</p>}
      {err && <p className="error">{err}</p>}
      {msg && <p className="note">{msg}</p>}

      {/* 1. Thông tin */}
      <section className="panel">
        <h2>1. Thông tin sản phẩm (khai báo để đăng bán)</h2>
        <div className="two">
          <label>
            Tên dự án (chỉ để bạn nhận biết)
            <input defaultValue={p.title} onBlur={(e) => e.target.value.trim() && patch({ title: e.target.value.trim() })} />
          </label>
          <label>
            Gắn với sản phẩm đã có trên web
            <select value={p.product_id || ''} onChange={(e) => linkProduct(e.target.value)}>
              <option value="">— Tạo sản phẩm mới khi đăng —</option>
              {products.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <InfoPanel info={p.info} categories={categories} onSave={(info) => patch({ info })} />
        <label>
          Tiêu đề lớn trên poster (để trống thì dùng tiêu đề của cốt truyện AI)
          <input
            key={p.poster_title || 'pt'}
            defaultValue={p.poster_title || ''}
            onBlur={(e) => patch({ poster_title: e.target.value })}
            placeholder="VD: BỘ KEYCAP HALLOWEEN"
          />
        </label>
        <label>
          Ý riêng thêm cho AI (tuỳ chọn, gõ tự do)
          <textarea
            rows="2"
            defaultValue={p.free_text || ''}
            onBlur={(e) => patch({ free_text: e.target.value })}
            placeholder="VD: thêm vài con dơi, tông tím cam, không dùng màu xanh lá"
          />
        </label>
      </section>

      {/* 2. Ảnh chụp */}
      <section className="panel">
        <h2>2. Ảnh chụp sản phẩm thật</h2>
        <p className="muted small">Chụp nhiều góc, nền sáng, đủ ánh sáng. Ảnh này là “nguồn thật” để AI giữ đúng hình dáng sản phẩm.</p>
        <AssetGrid assets={assets.filter((a) => a.kind === 'photo')} onApprove={setApproved} onRemove={removeAsset} showApprove={false} />
        <input type="file" accept={ACCEPT.photo} multiple onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; upload('photo', fl) }} />
      </section>

      {/* 3. Cốt truyện AI */}
      <section className="panel">
        <h2>3. AI gợi ý cốt truyện và concept</h2>
        <StoryPanel
          photos={assets.filter((a) => a.kind === 'photo')}
          info={p.info}
          story={p.story}
          onSave={(story) => patch({ story })}
          onUseGuess={useGuess}
          onPick={pickConcept}
        />
      </section>

      {/* 4. Lựa chọn */}
      <section className="panel">
        <div className="row between">
          <h2>4. Tinh chỉnh phong cách (tuỳ chọn, cộng thêm vào cốt truyện)</h2>
          <Link className="small" to="/admin/studio/thu-vien">
            Sửa thư viện ↗
          </Link>
        </div>
        {KINDS.map(({ kind, label, multi }) => {
          const opts = options.filter((o) => o.kind === kind)
          if (!opts.length) return null
          return (
            <KindPicker key={kind} label={label} multi={multi} opts={opts} sel={p.selections?.[kind] || []} onToggle={(oid) => toggle(kind, oid, multi)} />
          )
        })}
      </section>

      {/* 4. Câu lệnh */}
      <section className="panel">
        <h2>5. Tạo poster, ảnh góc và kịch bản</h2>
        <div className="lanes">
          <div className="lane on">
            <b>Làn tự động (AI Gemini)</b>
            <span className="muted small">Bấm một nút bên dưới: AI tạo poster và ảnh góc, trả thẳng vào dự án</span>
          </div>
          <div className="lane on">
            <b>Làn bán tự động</b>
            <span className="muted small">Gần như miễn phí: tự dán câu lệnh vào Gemini / Google Flow</span>
          </div>
        </div>
        <AutoGen
          photos={assets.filter((a) => a.kind === 'photo')}
          aspect={nearestRatio(ratioMeta?.w, ratioMeta?.h)}
          jobs={[
            { kind: 'poster', label: 'Poster chính', prompt: prompts.poster },
            ...prompts.angles.map((x) => ({ kind: 'angle', label: x.label, prompt: x.prompt })),
          ]}
          onSaveImage={async (kind, file) => {
            const { path, url } = await uploadStudioFile(file, `${id}/${kind}`)
            const { error } = await supabase.from('studio_assets').insert({ project_id: id, kind, url, storage_path: path })
            if (error) throw error
            load()
          }}
        />
        <p className="muted small">Cách tự làm (nếu muốn tiết kiệm):</p>
        <ol className="steps small">
          <li>
            Mở <a href="https://gemini.google.com/app" target="_blank" rel="noreferrer">Gemini</a>, chọn tạo ảnh, đính kèm ảnh chụp ở bước 2 (tải ở nút bên dưới).
          </li>
          <li>Bấm “Sao chép” câu lệnh bên dưới và dán vào Gemini. Chọn kết quả ưng ý.</li>
          <li>Tải ảnh về rồi đưa lên ở bước 6. Với clip AI, dùng <a href="https://labs.google/flow" target="_blank" rel="noreferrer">Google Flow</a> (có 50 credit miễn phí mỗi ngày).</li>
        </ol>
        {assets.some((a) => a.kind === 'photo') && (
          <p className="row small">
            <b>Gói ảnh tham chiếu:</b>
            {assets
              .filter((a) => a.kind === 'photo')
              .map((a, i) => (
                <button key={a.id} className="linkbtn" onClick={() => downloadUrl(a.url, `tham-chieu-${i + 1}.jpg`)}>
                  Tải ảnh {i + 1}
                </button>
              ))}
          </p>
        )}
        <CopyBox title="Câu lệnh poster chính" text={prompts.poster} hint="Dán kèm các ảnh chụp thật. Nếu chữ tiếng Việt sai dấu, gõ thêm yêu cầu sửa trong Gemini." />
        {prompts.angles.map((a) => (
          <CopyBox key={a.label} title={a.label} text={a.prompt} />
        ))}
        <CopyBox title="Câu lệnh clip AI (Google Flow / Veo)" text={prompts.clip} hint="Dùng poster hoặc ảnh góc đã chọn làm khung hình đầu." />
        <CopyBox title="Nhờ Gemini viết kịch bản & phụ đề" text={prompts.script} hint="Dán câu trả lời vào ô bên dưới. (Nếu đã chọn cốt truyện AI ở bước 3 thì kịch bản đã điền sẵn.)" />
        <label>
          Kịch bản và phụ đề (dán câu trả lời của Gemini)
          <textarea rows="6" defaultValue={p.script || ''} onBlur={(e) => patch({ script: e.target.value })} />
        </label>
      </section>

      {/* 5. Kết quả */}
      <section className="panel">
        <h2>6. Kết quả: tải lên và duyệt</h2>
        <p className="muted small">Tích “Dùng” cho những tệp bạn duyệt. Chỉ tệp được tích mới được đăng lên trang sản phẩm.</p>
        {['poster', 'angle', 'video', 'audio'].map((kind) => (
          <div key={kind} className="resblock">
            <div className="lbl">{KIND_LABEL[kind]}</div>
            <AssetGrid assets={assets.filter((a) => a.kind === kind)} onApprove={setApproved} onRemove={removeAsset} showApprove={kind !== 'audio'} />
            <input type="file" accept={ACCEPT[kind]} multiple={kind !== 'video'} onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; upload(kind, fl) }} />
          </div>
        ))}
      </section>

      {/* 7. Dựng video */}
      <VideoBuilder project={p} assets={assets} options={options} onSaved={load} onError={setErr} />

      {/* 7. Đăng */}
      <section className="panel">
        <h2>8. Duyệt và đăng bán</h2>
        <p className="small muted">
          Đăng sẽ tạo (hoặc cập nhật) sản phẩm với đúng giá, mô tả, thông số, link Shopee/TikTok đã khai ở bước 1, đưa poster và ảnh góc đã duyệt lên đầu, gắn video đã duyệt. Khách thấy giá và đặt hàng được ngay.
          {product ? ` Đang gắn: ${product.name}.` : ' Chưa gắn sản phẩm, sẽ tạo mới.'}
        </p>
        <div className="row">
          <button className="btn" onClick={publish}>
            {product ? 'Duyệt và cập nhật lên web' : 'Duyệt và đăng sản phẩm lên web'}
          </button>
          <button className="btn ghost" onClick={makeBanner}>Dùng poster làm banner sự kiện</button>
        </div>
        <h3 style={{ marginTop: 18 }}>Tệp để tự đăng lên Facebook, TikTok, Shopee</h3>
        {approvedFiles.length === 0 && <p className="muted small">Chưa có tệp nào được tích “Dùng”.</p>}
        <div className="row">
          {approvedFiles.map((a, i) => (
            <button key={a.id} className="btn ghost" onClick={() => downloadUrl(a.url, `${p.title}-${KIND_LABEL[a.kind]}-${i + 1}.${a.url.split('.').pop().split('?')[0]}`)}>
              ⬇ {KIND_LABEL[a.kind]} {i + 1}
            </button>
          ))}
        </div>
        <p className="muted small">
          Mẹo Shopee Video: định dạng MP4/MOV, dài 5 giây đến 3 phút. Video dựng ở bước 6 đã tự đảm bảo tối thiểu 5 giây.
        </p>
      </section>
    </div>
  )
}


const norm = (s = '') => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')

function KindPicker({ label, multi, opts, sel, onToggle }) {
  const [q, setQ] = useState('')
  const month = new Date().getMonth() + 1
  const next = (month % 12) + 1
  const soon = opts.filter((o) => (o.meta?.months || []).some((m) => m === month || m === next))
  const shown = q ? opts.filter((o) => norm(o.label + ' ' + (o.meta?.group || '')).includes(norm(q))) : opts
  const grouped = opts.some((o) => o.meta?.group)
  const groups = grouped ? [...new Set(shown.map((o) => o.meta?.group || 'Khác'))] : [null]
  const chip = (o) => (
    <button key={o.id} type="button" className={'chip' + (sel.includes(o.id) ? ' on' : '')} onClick={() => onToggle(o.id)}>
      {o.label}
    </button>
  )
  return (
    <div className="pick">
      <div className="row between">
        <div className="lbl">
          {label} <span className="muted small">{multi ? '(chọn nhiều)' : '(chọn một)'} · {opts.length} lựa chọn</span>
        </div>
        {opts.length > 12 && (
          <input className="search" type="search" placeholder="Tìm: Tết, Trung thu, gaming…" value={q} onChange={(e) => setQ(e.target.value)} />
        )}
      </div>
      {!q && soon.length > 0 && (
        <div className="soon">
          <span className="small">📅 Gợi ý cho tháng {month}–{next}:</span>
          <div className="chips">{soon.map(chip)}</div>
        </div>
      )}
      {groups.map((g) => (
        <div key={g || 'all'}>
          {g && <div className="grp small muted">{g}</div>}
          <div className="chips">{(g ? shown.filter((o) => (o.meta?.group || 'Khác') === g) : shown).map(chip)}</div>
        </div>
      ))}
      {q && shown.length === 0 && <p className="muted small">Không thấy. Thử từ khoá khác hoặc thêm lựa chọn mới ở “Sửa thư viện”.</p>}
    </div>
  )
}

function AssetGrid({ assets, onApprove, onRemove, showApprove = true }) {
  if (!assets.length) return <p className="muted small">Chưa có tệp nào.</p>
  return (
    <div className="assets">
      {assets.map((a) => (
        <div key={a.id} className={'asset' + (a.approved ? ' ok' : '')}>
          <AssetPreview a={a} />
          <div className="row between small">
            {showApprove ? (
              <label className="check">
                <input type="checkbox" checked={a.approved} onChange={(e) => onApprove(a, e.target.checked)} /> Dùng
              </label>
            ) : (
              <span />
            )}
            <button className="linkbtn" onClick={() => onRemove(a)}>
              Xoá
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function VideoBuilder({ project, assets, options, onSaved, onError }) {
  const imgs = assets.filter((a) => ['poster', 'angle', 'photo'].includes(a.kind))
  const ratios = options.filter((o) => o.kind === 'ratio' && o.meta?.w)
  const selRatios = picked(project.selections, options, 'ratio').filter((o) => o.meta?.w)
  const defaultRatio = (selRatios.find((o) => o.meta.h > o.meta.w) || selRatios[0] || ratios.find((o) => o.meta.h > o.meta.w) || ratios[0])?.id
  const motion = picked(project.selections, options, 'motion').find((o) => o.meta?.ffmpeg)?.meta.ffmpeg || 'zoom_in'
  const capStyle = picked(project.selections, options, 'caption')[0]?.meta?.style || 'tiktok'

  const [chosen, setChosen] = useState([])
  const [ratioId, setRatioId] = useState(defaultRatio)
  const [sec, setSec] = useState(2.5)
  const [hd, setHd] = useState(false)
  const [captionsText, setCaptionsText] = useState('')
  const [audioFile, setAudioFile] = useState(null)
  const [audioId, setAudioId] = useState('')
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const touched = useRef(false)
  const userPicked = useRef(false)

  useEffect(() => {
    if (!ratioId && defaultRatio) setRatioId(defaultRatio)
  }, [defaultRatio])
  useEffect(() => {
    if (!touched.current) setCaptionsText(extractCaptions(project.script || '').join('\n'))
  }, [project.script])
  useEffect(() => {
    // Tự chọn poster + ảnh góc đã duyệt, cho tới khi bạn tự bấm chọn ảnh
    if (userPicked.current) return
    setChosen(imgs.filter((a) => a.approved && a.kind !== 'photo').map((a) => a.id))
  }, [assets])

  const audios = assets.filter((a) => a.kind === 'audio')
  const ratio = ratios.find((o) => o.id === ratioId)?.meta

  const toggle = (aid) => {
    userPicked.current = true
    setChosen((c) => (c.includes(aid) ? c.filter((x) => x !== aid) : [...c, aid]))
  }

  const run = async () => {
    onError('')
    setResult(null)
    try {
      setProgress(0)
      const r = await renderSlideshow({
        images: chosen.map((cid) => imgs.find((a) => a.id === cid)?.url).filter(Boolean),
        ratio: ratio || { w: 1080, h: 1920 },
        shortSide: hd ? 1080 : 720,
        secondsPerImage: Number(sec) || 2.5,
        motion,
        captions: captionsText.split('\n').map((s) => s.trim()).filter(Boolean),
        captionStyle: capStyle,
        audioFile,
        audioUrl: !audioFile && audioId ? audios.find((a) => a.id === audioId)?.url : null,
        onProgress: setProgress,
      })
      setResult({ ...r, url: URL.createObjectURL(r.blob) })
    } catch (e) {
      onError(e.message || String(e))
    }
    setProgress(null)
  }

  const save = async () => {
    try {
      const file = new File([result.blob], `video.${result.ext}`, { type: result.type.split(';')[0] })
      const { path, url } = await uploadStudioFile(file, `${project.id}/video`)
      const { error } = await supabase.from('studio_assets').insert({ project_id: project.id, kind: 'video', approved: true, url, storage_path: path })
      if (error) throw error
      setResult(null)
      onSaved()
    } catch (e) {
      onError(e.message || String(e))
    }
  }

  return (
    <section className="panel">
      <h2>7. Dựng video ngay trong trình duyệt (miễn phí)</h2>
      <p className="muted small">
        Ghép ảnh thành video có chuyển động, phụ đề và nhạc. Video dựng theo thời gian thực, nên giữ tab mở cho đến khi xong. Chuyển động:{' '}
        <b>{{ zoom_in: 'zoom chậm', pan: 'lia ngang', fast_cuts: 'nhịp nhanh' }[motion]}</b>, phụ đề: <b>{capStyle}</b> (đổi ở bước 3).
      </p>
      {imgs.length === 0 && <p className="muted small">Hãy tải ảnh ở bước 2 hoặc bước 5 trước.</p>}
      <div className="lbl">Chọn ảnh theo thứ tự xuất hiện (bấm để chọn, thứ tự = thứ tự bấm)</div>
      <div className="assets">
        {imgs.map((a) => (
          <div key={a.id} className={'asset selectable' + (chosen.includes(a.id) ? ' ok' : '')} onClick={() => toggle(a.id)}>
            <img src={a.url} alt="" />
            <div className="small">
              {chosen.includes(a.id) ? `#${chosen.indexOf(a.id) + 1}` : ''} {KIND_LABEL[a.kind]}
            </div>
          </div>
        ))}
      </div>
      <div className="two">
        <label>
          Khung hình
          <select value={ratioId || ''} onChange={(e) => setRatioId(e.target.value)}>
            {ratios.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Giây mỗi ảnh
          <input type="number" min="1" max="8" step="0.5" value={sec} onChange={(e) => setSec(e.target.value)} />
        </label>
      </div>
      <label>
        Dòng phụ đề (mỗi dòng một câu, lấy tự động từ kịch bản bước 4)
        <textarea
          rows="4"
          value={captionsText}
          onChange={(e) => {
            touched.current = true
            setCaptionsText(e.target.value)
          }}
        />
      </label>
      <div className="two">
        <label>
          Nhạc nền (chọn tệp từ máy)
          <input type="file" accept="audio/*" onChange={(e) => { setAudioFile(e.target.files[0] || null); setAudioId('') }} />
        </label>
        {audios.length > 0 && (
          <label>
            …hoặc nhạc đã tải lên dự án
            <select value={audioId} onChange={(e) => { setAudioId(e.target.value); setAudioFile(null) }}>
              <option value="">— Không dùng —</option>
              {audios.map((a, i) => (
                <option key={a.id} value={a.id}>
                  Nhạc {i + 1}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="check">
        <input type="checkbox" checked={hd} onChange={(e) => setHd(e.target.checked)} /> Full HD 1080 (chậm và nặng máy hơn, mặc định 720)
      </label>
      <p className="muted small">Dùng nhạc có bản quyền hoặc nhạc miễn phí bản quyền để tránh bị khoá video trên các nền tảng.</p>
      <button className="btn" disabled={progress !== null || chosen.length === 0} onClick={run}>
        {progress !== null ? `Đang dựng… ${Math.round(progress * 100)}%` : 'Dựng video'}
      </button>
      {result && (
        <div className="resblock">
          <video src={result.url} controls style={{ maxHeight: 420 }} />
          <p className="muted small">
            {result.width}×{result.height}, {result.seconds.toFixed(1)} giây, định dạng {result.ext.toUpperCase()}.
            {result.ext === 'webm' && ' Trình duyệt này xuất WebM. Shopee cần MP4 nên hãy dựng bằng Chrome/Edge mới nhất hoặc đổi định dạng bằng công cụ miễn phí.'}
          </p>
          <div className="row">
            <button className="btn" onClick={save}>
              Lưu vào dự án
            </button>
            <button className="btn ghost" onClick={() => downloadUrl(result.url, `video.${result.ext}`)}>
              Tải về
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
