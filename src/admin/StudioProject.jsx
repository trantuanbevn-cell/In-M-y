import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase.js'
import { KINDS, buildPrompts, chosenConcept, extractCaptions, picked, scriptFromConcept } from './studio/prompts.js'
import { AutoGen, InfoPanel, StoryPanel, callFn, nearestRatio, shrink } from './studio/panels.jsx'
import { ZoomProvider, useZoom } from './studio/Lightbox.jsx'
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
  const [show, setShow] = useState(false)
  return (
    <div className="promptbox">
      <div className="row between">
        <b>{title}</b>
        <span className="row">
          <button type="button" className="chip" onClick={() => setShow(!show)}>
            {show ? 'Thu gọn' : 'Xem'}
          </button>
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
        </span>
      </div>
      {show && hint && <p className="muted small">{hint}</p>}
      {show && <pre>{text}</pre>}
    </div>
  )
}

// Mục tính năng: bấm ô để mở bảng lớn giữa màn hình, chọn xong thì đóng lại
const TILE = { info: ['📝', 'sky'], photos: ['📸', 'pink'], story: ['✨', 'violet'], style: ['🎨', 'amber'], gen: ['🖼️', 'mint'], video: ['🎬', 'coral'] }

function Acc({ id, title, summary, open, onToggle, next, keepAlive, children }) {
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onToggle('')
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [open])
  const isDone = !!summary && !/^(Chưa|0)/.test(summary)
  return (
    <>
      <button type="button" className={`tile tone-${TILE[id]?.[1] || 'sky'}` + (isDone ? ' done' : '')} onClick={() => onToggle(id)}>
        <span className="tile-ic" aria-hidden="true">{TILE[id]?.[0] || '•'}</span>
        <span className="tile-tx">
          <span className="tile-t">{title.replace(/^\d+\.\s*/, '')}</span>
          <span className="tile-s">{summary}</span>
        </span>
        <span className="tile-n">{isDone ? '✓' : title.match(/^\d+/)?.[0]}</span>
      </button>
      {(open || keepAlive) && (
        <div className="sdlg-bg" style={open ? undefined : { display: 'none' }} onClick={() => onToggle('')}>
          <div className="sdlg" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
            <div className="sdlg-h">
              <h2>{title}</h2>
              <button type="button" className="sdlg-x" onClick={() => onToggle('')} aria-label="Đóng">✕</button>
            </div>
            <div className="sdlg-b">{children}</div>
            <div className="sdlg-f">
              <button type="button" className="btn ghost" onClick={() => onToggle('')}>Đóng</button>
              <button type="button" className="btn" onClick={() => onToggle(next || '')}>
                {next ? 'Xong, mục tiếp theo' : 'Xong'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Phong cách: mỗi nhóm một thẻ tab, chỉ hiện một nhóm
function StylePanel({ options, selections, onToggle }) {
  const kinds = KINDS.filter((k) => options.some((o) => o.kind === k.kind))
  const [tab, setTab] = useState(kinds[0]?.kind)
  const cur = kinds.find((k) => k.kind === tab) || kinds[0]
  if (!cur) return <p className="muted small">Thư viện đang trống.</p>
  const chosen = kinds.flatMap((k) => picked(selections, options, k.kind).map((o) => ({ ...o, _multi: k.multi })))
  return (
    <div>
      <div className="tabs">
        {kinds.map((k) => {
          const n = (selections?.[k.kind] || []).length
          return (
            <button key={k.kind} type="button" className={'tabbtn' + (k.kind === cur.kind ? ' on' : '')} onClick={() => setTab(k.kind)}>
              {k.label}
              {n > 0 && <span className="cnt">{n}</span>}
            </button>
          )
        })}
      </div>
      {chosen.length > 0 && (
        <div className="chosen">
          <span className="small muted">Đã chọn:</span>
          {chosen.map((o) => (
            <button key={o.id} type="button" className="chip on small" title="Bấm để bỏ" onClick={() => onToggle(o.kind, o.id, o._multi)}>
              {o.label} ✕
            </button>
          ))}
        </div>
      )}
      <KindPicker
        key={cur.kind}
        label={cur.label}
        multi={cur.multi}
        opts={options.filter((o) => o.kind === cur.kind)}
        sel={selections?.[cur.kind] || []}
        onToggle={(oid) => onToggle(cur.kind, oid, cur.multi)}
      />
    </div>
  )
}

function AssetPreview({ a, group }) {
  const zoom = useZoom()
  const items = (group || [a]).filter((x) => x.kind !== 'audio').map((x) => ({ kind: x.kind === 'video' ? 'video' : 'image', url: x.url, caption: KIND_LABEL[x.kind] }))
  const at = Math.max(0, (group || [a]).filter((x) => x.kind !== 'audio').findIndex((x) => x.id === a.id))
  if (a.kind === 'audio') return <audio src={a.url} controls />
  if (a.kind === 'video')
    return (
      <>
        <video src={a.url} controls preload="metadata" />
        <button type="button" className="zoombtn" title="Xem lớn" onClick={() => zoom(items, at)}>⤢</button>
      </>
    )
  return <img className="zoomable" src={a.url} alt="" title="Bấm để xem lớn" onClick={() => zoom(items, at)} />
}

export default function StudioProject() {
  return (
    <ZoomProvider>
      <StudioProjectInner />
    </ZoomProvider>
  )
}

function StudioProjectInner() {
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
  const [open, setOpen] = useState(null)

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
  useEffect(() => {
    if (loaded && open === null) setOpen('')
  }, [loaded])

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

  const pickPoster = async (a) => {
    setAssets((cur) => cur.map((x) => (x.kind === 'poster' ? { ...x, approved: x.id === a.id } : x)))
    await supabase.from('studio_assets').update({ approved: false }).eq('project_id', id).eq('kind', 'poster')
    await supabase.from('studio_assets').update({ approved: true }).eq('id', a.id)
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
  const photoN = assets.filter((a) => a.kind === 'photo').length
  const styleN = Object.values(p.selections || {}).reduce((n, arr) => n + (arr?.length || 0), 0)
  const infoSum = p.info?.name ? `${p.info.name}${Number(p.info.price) ? ' · ' + Number(p.info.price).toLocaleString('vi-VN') + 'đ' : ''}` : 'Chưa điền'

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

      <div className="studio-grid">
      <aside className="studio-set tiles">
      {/* 1. Thông tin */}
      <Acc id="info" title="1. Thông tin sản phẩm" summary={infoSum} open={open === 'info'} onToggle={setOpen} next="photos">
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
      </Acc>

      {/* 2. Ảnh chụp */}
      <Acc id="photos" title="2. Ảnh chụp thật" summary={photoN ? `${photoN} ảnh` : 'Chưa có ảnh'} open={open === 'photos'} onToggle={setOpen} next="story">
        <p className="muted small">Chụp nhiều góc, nền sáng, đủ ánh sáng. Ảnh này là “nguồn thật” để AI giữ đúng hình dáng sản phẩm.</p>
        <AssetGrid assets={assets.filter((a) => a.kind === 'photo')} onApprove={setApproved} onRemove={removeAsset} showApprove={false} />
        <input type="file" accept={ACCEPT.photo} multiple onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; upload('photo', fl) }} />
      </Acc>

      {/* 3. Cốt truyện AI */}
      <Acc id="story" title="3. Cốt truyện AI" summary={concept ? concept.title : p.story?.concepts?.length ? 'Chưa chọn' : 'Chưa có'} open={open === 'story'} onToggle={setOpen} next="style">
        <StoryPanel
          photos={assets.filter((a) => a.kind === 'photo')}
          info={p.info}
          story={p.story}
          onSave={(story) => patch({ story })}
          onUseGuess={useGuess}
          onPick={pickConcept}
        />
      </Acc>

      {/* 4. Lựa chọn */}
      <Acc id="style" title="4. Phong cách (tuỳ chọn)" summary={styleN ? `${styleN} lựa chọn` : 'Chưa chọn'} open={open === 'style'} onToggle={setOpen} next="gen">
        <p className="small"><Link to="/admin/studio/thu-vien">Sửa thư viện ↗</Link></p>
        <StylePanel options={options} selections={p.selections} onToggle={toggle} />
      </Acc>

      {/* 4. Câu lệnh */}
      <Acc id="gen" title="5. Tạo ảnh bằng AI" summary={(p.mode === 'manual' ? 'Bán tự động' : 'Tự động') + ' · 3 poster + ' + prompts.angles.length + ' ảnh phụ'} open={open === 'gen'} onToggle={setOpen}>
        <div className="modecards">
          <button type="button" className={'modecard' + (p.mode !== 'manual' ? ' on' : '')} onClick={() => patch({ mode: 'auto' })}>
            <b>⚡ Tự động (AI Gemini)</b>
            <span className="small muted">Bấm nút, AI vẽ poster và ảnh phụ ngay trong app. Mất phí nhỏ mỗi ảnh.</span>
          </button>
          <button type="button" className={'modecard' + (p.mode === 'manual' ? ' on' : '')} onClick={() => patch({ mode: 'manual' })}>
            <b>✋ Bán tự động</b>
            <span className="small muted">App soạn sẵn câu lệnh, bạn dán vào Gemini/Flow rồi tải ảnh lên. Tiết kiệm.</span>
          </button>
        </div>
        {p.mode !== 'manual' && (
          <AutoGen
            photos={assets.filter((a) => a.kind === 'photo')}
            aspect={nearestRatio(ratioMeta?.w, ratioMeta?.h)}
            posterJobs={prompts.posters.map((x) => ({ kind: 'poster', label: x.label, prompt: x.prompt }))}
            angleJobs={prompts.angles.map((x) => ({ kind: 'angle', label: x.label, prompt: x.prompt }))}
            posters={assets.filter((a) => a.kind === 'poster')}
            chosenPoster={assets.filter((a) => a.kind === 'poster' && a.approved).pop() || null}
            onPickPoster={pickPoster}
            onSaveImage={async (kind, file) => {
              const { path, url } = await uploadStudioFile(file, `${id}/${kind}`)
              const { error } = await supabase.from('studio_assets').insert({ project_id: id, kind, url, storage_path: path, approved: false })
              if (error) throw error
              load()
            }}
          />
        )}
        <details className="manual" open={p.mode === 'manual'} key={p.mode}>
        <summary className="small">Cách tự làm bằng Gemini / Google Flow (tiết kiệm)</summary>
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
        </details>
        <label>
          Kịch bản và phụ đề (dùng cho video)
          <textarea rows="4" key={p.script || 'sc'} defaultValue={p.script || ''} onBlur={(e) => patch({ script: e.target.value })} />
        </label>
      </Acc>
      {/* 6. Tạo video */}
      <Acc id="video" title="6. Tạo video" summary={assets.filter((a) => a.kind === 'video').length ? `${assets.filter((a) => a.kind === 'video').length} video` : 'Chưa có video'} open={open === 'video'} onToggle={setOpen} keepAlive>
        <VideoBuilder bare project={p} assets={assets} options={options} onSaved={load} onError={setErr} />
        <p className="muted small">Có thể đóng bảng khi AI đang tạo: clip vẫn chạy nền và hiện ở mục Kết quả → Video.</p>
      </Acc>
      </aside>

      <div className="studio-out">

      {/* 5. Kết quả */}
      <section className="panel">
        <h2>Kết quả</h2>
        <p className="muted small">Tích “Dùng” cho những tệp bạn duyệt. Chỉ tệp được tích mới được đăng lên trang sản phẩm.</p>
        {['poster', 'angle', 'video', 'audio'].map((kind) => (
          <div key={kind} className="resblock">
            <div className="lbl">{KIND_LABEL[kind]}</div>
            <AssetGrid assets={assets.filter((a) => a.kind === kind)} onApprove={setApproved} onRemove={removeAsset} showApprove={kind !== 'audio'} />
            <input type="file" accept={ACCEPT[kind]} multiple={kind !== 'video'} onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; upload(kind, fl) }} />
          </div>
        ))}
      </section>

      {/* 7. Đăng */}
      <section className="panel">
        <h2>Duyệt và đăng bán</h2>
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
      </div>
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
          <AssetPreview a={a} group={assets} />
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

function VideoBuilder({ project, assets, options, onSaved, onError, bare }) {
  const zoom = useZoom()
  const [tab, setTab] = useState(project.mode === 'manual' ? 'mix' : 'ai')
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

  const useAi = () => {
    userPicked.current = true
    const ok = (k) => imgs.filter((a) => a.kind === k && a.approved)
    setChosen([...ok('poster').slice(-1), ...ok('angle')].map((a) => a.id))
  }

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

  const aiImgs = chosen.map((cid) => imgs.find((a) => a.id === cid)).filter(Boolean)
  const Wrap = bare ? 'div' : 'section'
  return (
    <Wrap className={bare ? 'vbare' : 'panel'}>
      {!bare && <h2>Dựng video</h2>}
      <div className="tabs">
        <button type="button" className={'tabbtn' + (tab === 'ai' ? ' on' : '')} onClick={() => setTab('ai')}>🤖 AI tạo video (tính phí)</button>
        <button type="button" className={'tabbtn' + (tab === 'mix' ? ' on' : '')} onClick={() => setTab('mix')}>🎞 Ghép ảnh (miễn phí)</button>
      </div>
      {imgs.length === 0 && <p className="muted small">Hãy tải ảnh ở bước 2 hoặc tạo ảnh ở bước 5 trước.</p>}
      <div className="row between">
        <div className="lbl">Chọn ảnh theo thứ tự xuất hiện (bấm để chọn)</div>
        <button type="button" className="chip" onClick={useAi}>Dùng poster + ảnh phụ AI đã duyệt</button>
      </div>
      <div className="assets">
        {imgs.map((a) => (
          <div key={a.id} className={'asset selectable' + (chosen.includes(a.id) ? ' ok' : '')} onClick={() => toggle(a.id)}>
            <img src={a.url} alt="" />
            <button type="button" className="zoombtn" title="Xem lớn" onClick={(e) => { e.stopPropagation(); zoom(imgs.map((x) => ({ kind: 'image', url: x.url, caption: KIND_LABEL[x.kind] })), imgs.indexOf(a)) }}>⤢</button>
            <div className="small">
              {chosen.includes(a.id) ? `#${chosen.indexOf(a.id) + 1}` : ''} {KIND_LABEL[a.kind]}
            </div>
          </div>
        ))}
      </div>
      {tab === 'ai' && <AiVideo project={project} images={aiImgs} onSaved={onSaved} onError={onError} />}
      {tab === 'mix' && (<>
      <p className="muted small">
        Ghép ảnh thành video có chuyển động, phụ đề và nhạc. Dựng theo thời gian thực nên giữ tab mở đến khi xong. Chuyển động:{' '}
        <b>{{ zoom_in: 'zoom chậm', pan: 'lia ngang', fast_cuts: 'nhịp nhanh' }[motion]}</b>, phụ đề: <b>{capStyle}</b>.
      </p>
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
      </>)}
    </Wrap>
  )
}


// Giá tham khảo Google công bố: khoảng 0,10 USD mỗi giây ở 720p. 360p và 1080p là ước tính theo tỉ lệ credit.
const RATE = { '360p': 0.035, '720p': 0.1, '1080p': 0.133 }
const VND = 25500
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Mỗi ảnh được chọn thành một clip video do Gemini Omni tạo, lưu vào dự án (chưa duyệt)
function AiVideo({ project, images, onSaved, onError }) {
  const concept = chosenConcept(project)
  const [aspect, setAspect] = useState('9:16')
  const [seconds, setSeconds] = useState(5)
  const [res, setRes] = useState('720p')
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const cost = images.length * seconds * RATE[res]

  const run = async () => {
    onError('')
    if (!images.length) return onError('Hãy chọn ít nhất một ảnh ở trên.')
    if (!confirm(`Tạo ${images.length} clip x ${seconds} giây, ${aspect}, ${res}.\nChi phí ước tính khoảng $${cost.toFixed(2)} (~${(Math.round((cost * VND) / 1000) * 1000).toLocaleString('vi-VN')}đ) trừ vào tài khoản Google AI.\nTiếp tục?`)) return
    setBusy(true)
    try {
      for (let i = 0; i < images.length; i++) {
        setStatus(`Clip ${i + 1}/${images.length}: đang gửi cho AI…`)
        const img = await shrink(images[i].url, 1280)
        const shot = concept?.storyboard?.[i]?.motion_en || 'slow cinematic push-in with gentle parallax'
        const prompt = [
          `Camera and motion: ${shot}.`,
          concept?.mood_en ? `Mood: ${concept.mood_en}.` : '',
          note.trim(),
          `Keep the product's shape, colors and printed details unchanged. No text overlays, no new objects, no people.`,
        ].filter(Boolean).join(' ')
        const st = await callFn('studio-video', { action: 'start', prompt, image: img, aspect, seconds, resolution: res })
        const t0 = Date.now()
        for (;;) {
          await sleep(8000)
          setStatus(`Clip ${i + 1}/${images.length}: AI đang dựng… ${Math.round((Date.now() - t0) / 1000)} giây`)
          const out = await callFn('studio-video', { action: 'poll', id: st.id, project_id: project.id })
          if (out.done) break
          if (Date.now() - t0 > 10 * 60 * 1000) throw new Error('AI quá lâu chưa xong, thử lại sau.')
        }
        onSaved()
      }
      setStatus('Xong. Các clip nằm ở mục Kết quả → Video, bấm vào để xem lớn và tích “Dùng” clip bạn chọn.')
    } catch (e) {
      onError(e.message || String(e))
      setStatus('')
    }
    setBusy(false)
  }

  return (
    <div className="aivid">
      <p className="muted small">Mỗi ảnh đã chọn trở thành một clip video có âm thanh (Google Gemini Omni Flash). Clip lưu ở mục Kết quả để bạn xem và tích “Dùng”. Thử nghiệm nên chọn 360p cho rẻ.</p>
      <div className="two">
        <label>Khổ video
          <select value={aspect} onChange={(e) => setAspect(e.target.value)}>
            <option value="9:16">Dọc 9:16 (TikTok, Reels, Shopee Video)</option>
            <option value="16:9">Ngang 16:9 (YouTube, web)</option>
          </select>
        </label>
        <label>Số giây mỗi clip
          <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n} giây</option>)}
          </select>
        </label>
      </div>
      <label>Chất lượng
        <select value={res} onChange={(e) => setRes(e.target.value)}>
          <option value="360p">360p (nháp, rẻ nhất)</option>
          <option value="720p">720p (chuẩn)</option>
          <option value="1080p">1080p (nâng độ phân giải)</option>
        </select>
      </label>
      <label>Ý thêm cho chuyển động (tuỳ chọn)
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: ánh đèn nhấp nháy ấm, khói nhẹ bay lên" />
      </label>
      <p className="small"><b>Ước tính:</b> {images.length} clip × {seconds}s × ${RATE[res]}/s = <b>${cost.toFixed(2)}</b> (~{(Math.round((cost * VND) / 1000) * 1000).toLocaleString('vi-VN')}đ)</p>
      <button className="btn" disabled={busy || !images.length} onClick={run}>{busy ? 'Đang tạo…' : `Tạo ${images.length || ''} clip bằng AI`}</button>
      {status && <p className="note">{status}</p>}
    </div>
  )
}
