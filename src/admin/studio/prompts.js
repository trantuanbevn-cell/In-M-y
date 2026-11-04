// Định nghĩa các hạng mục thư viện và hàm ghép câu lệnh từ lựa chọn

export const KINDS = [
  { kind: 'poster_style', label: 'Kiểu poster', multi: false },
  { kind: 'scene', label: 'Bối cảnh', multi: true },
  { kind: 'audience', label: 'Đối tượng', multi: true },
  { kind: 'badge', label: 'Huy hiệu trên poster', multi: true },
  { kind: 'cta', label: 'Nút kêu gọi', multi: false },
  { kind: 'ratio', label: 'Khung hình', multi: true },
  { kind: 'motion', label: 'Hiệu ứng chuyển động', multi: true },
  { kind: 'voice', label: 'Giọng đọc', multi: false },
  { kind: 'music', label: 'Nhạc nền', multi: false },
  { kind: 'caption', label: 'Kiểu phụ đề', multi: false },
]

export const picked = (selections, options, kind) => {
  const ids = selections?.[kind] || []
  return options.filter((o) => o.kind === kind && ids.includes(o.id))
}

const list = (arr, key = 'prompt') => arr.map((o) => o[key]).filter(Boolean)

export const chosenConcept = (project) => {
  const st = project?.story
  return st && Number.isInteger(st.chosen) ? st.concepts?.[st.chosen] || null : null
}

export const scriptFromConcept = (c) =>
  c ? `LỜI ĐỌC: ${c.voiceover}\nPHỤ ĐỀ:\n${(c.captions || []).map((x) => `- ${x}`).join('\n')}` : ''

export function buildPrompts({ project, product, options }) {
  const concept = chosenConcept(project)
  const info = project.info || {}
  const sel = project.selections || {}
  const P = (k) => picked(sel, options, k)
  const name = info.name || product?.name || project.title
  const conceptScene = concept
    ? [
        concept.setting_en,
        concept.props_en?.length ? `props: ${concept.props_en.join(', ')}` : '',
        concept.mood_en ? `mood and lighting: ${concept.mood_en}` : '',
        concept.palette_en ? `color palette: ${concept.palette_en}` : '',
      ].filter(Boolean).join('. ')
    : ''
  const scene = [conceptScene, ...list(P('scene'))].filter(Boolean).join('; ') || 'a clean, attractive background that suits the product'
  const audience = list(P('audience')).join('; ')
  const style = list(P('poster_style')).join('; ') || 'a clean, eye-catching promotional poster'
  const badges = [...(concept?.badges || []), ...list(P('badge'))]
  const cta = list(P('cta'))[0] || concept?.cta
  const ratio = list(P('ratio'))[0] || '1:1'
  const free = (project.free_text || '').trim()
  const title = (project.poster_title || concept?.poster_headline || '').trim()

  const LAYOUTS = [
    ['Phương án A', 'Layout A (centered hero): the product large and centered, big title at the top, promo badges around it, call-to-action ribbon at the bottom. Symmetrical, bold and clear.'],
    ['Phương án B', 'Layout B (dynamic diagonal): product placed off-center at a slight angle in the lower right, huge stacked title on the left, energetic shapes and motion, badges overlapping the edges.'],
    ['Phương án C', 'Layout C (minimal editorial): lots of clean negative space, product on a simple pedestal or surface, small elegant title, only one badge and a thin call-to-action line. Premium, calm look.'],
  ]
  const posterBase = [
    `Create a promotional poster for "InMây", a shop selling personalized 3D-printed products (tagline: "In những giấc mơ").`,
    `Use the attached reference photos as the REAL products. Keep their exact shape, colors and details. Do not redraw them or invent different products.`,
    `Product: ${name}${(info.description || product?.description) ? ` — ${info.description || product?.description}` : ''}.`,
    concept ? `Story concept (the whole image must tell this story, the product is the hero): ${concept.title} — ${concept.story}` : '',
    concept?.poster_tagline ? `Small tagline under the title (Vietnamese, exact): "${concept.poster_tagline}".` : '',
    title ? `Large poster title (Vietnamese, spell exactly, keep all diacritics): "${title}".` : '',
    `Poster style: ${style}.`,
    `Scene and background: ${scene}.`,
    audience ? `Target audience: ${audience}.` : '',
    badges.length ? `Promo badges (render this exact Vietnamese text): ${badges.map((b) => `"${b}"`).join(', ')}.` : '',
    cta ? `Call-to-action ribbon (exact text): "${cta}".` : '',
    `Aspect ratio: ${ratio}.`,
    free ? `Extra instructions: ${free}` : '',
    `All text must be spelled exactly as given with Vietnamese diacritics preserved. No watermarks, no extra logos.`,
  ].filter(Boolean)
  const posters = LAYOUTS.map(([label, lay]) => ({ label, prompt: [...posterBase, lay].join('\n') }))
  const poster = posters[0].prompt

  // Quy tắc hình học theo góc máy: nền phải khớp với góc nhìn
  const viewOf = (a) => {
    const t = `${a.label || ''} ${a.prompt_en || ''}`.toLowerCase()
    if (/top-?down|overhead|flat-?lay|bird|từ trên|trên cao|nhìn từ trên/.test(t)) return 'top'
    if (/macro|close-?up|detail|cận|chi tiết/.test(t)) return 'macro'
    return 'mid'
  }
  const GEO = {
    top: 'CAMERA GEOMETRY: the camera is directly above the product, pointing straight down at 90 degrees (true flat-lay). The product lies on a flat horizontal surface (table, fabric, paper or wood) seen from above. The background is ONLY that flat surface filling the whole frame: NO walls, NO horizon line, NO shelves, NO windows, NO sky, NO vertical perspective. Props are laid flat around the product and are also seen from above. Light is soft and comes from above, shadows fall directly under the objects.',
    macro: 'CAMERA GEOMETRY: extreme close-up with a macro lens, very shallow depth of field. Only the product surface, edges and print texture are sharp. The background is fully out of focus, a soft bokeh made of the scene colors, with no recognizable objects.',
    mid: 'CAMERA GEOMETRY: the camera is about 45 degrees above the product at a normal lens distance. The product stands on a surface; behind it the room, wall or shelf is visible in correct perspective, with a horizon line behind the product, gentle depth of field, and shadows that match the light direction.',
  }
  const sceneNoRoom = [concept?.props_en?.length ? `props: ${concept.props_en.join(', ')}` : '', concept?.mood_en ? `mood: ${concept.mood_en}` : '', concept?.palette_en ? `color palette: ${concept.palette_en}` : ''].filter(Boolean).join('; ')
  const angleBase = (a) => {
    const v = viewOf(a)
    return [
      `The first attached image is the APPROVED POSTER: match its color palette, lighting and mood, but do NOT copy its layout or any text. The other attached photos show the real product "${name}".`,
      `Create a lifestyle product image. Keep the product's exact shape, colors and details unchanged.`,
      GEO[v],
      v === 'top' ? `Surface and props: ${sceneNoRoom || 'a plain wooden or fabric table top with a few small matching props'}.` : `Scene and background: ${scene}.`,
      v === 'mid' && a.prompt_en ? `Composition idea: ${a.prompt_en}` : '',
      audience ? `Mood for audience: ${audience}.` : '',
      `Aspect ratio: ${ratio}. No text, no watermark.`,
      free ? `Extra instructions: ${free}` : '',
    ].filter(Boolean).join('\n')
  }
  const baseAngles = concept?.angle_shots?.length
    ? concept.angle_shots.slice(0, 3)
    : [
        { label: 'Ảnh góc 45° trong bối cảnh', prompt_en: 'three-quarter 45-degree angle, product in focus, soft depth of field' },
        { label: 'Ảnh cận chi tiết', prompt_en: 'macro close-up showing surface detail and print texture' },
        { label: 'Ảnh nhìn từ trên xuống', prompt_en: 'top-down flat-lay composition with a few matching props' },
      ]
  const angles = baseAngles.map((a) => ({ label: a.label, prompt: angleBase(a), view: viewOf(a) }))

  const motions = list(P('motion')).join('; ') || (concept?.storyboard?.length ? concept.storyboard.map((s, i) => `shot ${i + 1}: ${s.motion_en}`).join('; ') : 'slow cinematic push-in on the product')
  const music = list(P('music'))[0]
  const clip = [
    `Animate the attached image into a short vertical video clip (about 6 seconds, 9:16).`,
    concept ? `Story: ${concept.story}` : '',
    `Motion: ${motions}.`,
    `Keep the product's shape, colors and any printed text unchanged. No new objects, no text changes.`,
    music ? `Mood: ${music}.` : '',
    free ? `Extra instructions: ${free}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const voice = list(P('voice'))[0]
  const script = [
    `Viết kịch bản video quảng cáo ngắn khoảng 15–20 giây bằng tiếng Việt cho sản phẩm in 3D của shop InMây (slogan "In những giấc mơ").`,
    `Sản phẩm: ${name}${product?.description ? ` — ${product.description}` : ''}.`,
    audience ? `Đối tượng (mô tả tiếng Anh): ${audience}.` : '',
    `Không khí/bối cảnh: ${scene}.`,
    voice ? `Giọng đọc: ${voice}.` : '',
    `Yêu cầu: lời đọc 2–4 câu ngắn, tự nhiên, không phóng đại, không hứa điều không có thật.`,
    cta ? `Kết bằng lời kêu gọi: "${cta}".` : '',
    free ? `Ghi chú thêm: ${free}` : '',
    `Trả lời đúng định dạng:`,
    `LỜI ĐỌC: ...`,
    `PHỤ ĐỀ:`,
    `- (4–6 dòng, mỗi dòng tối đa 8 từ)`,
  ]
    .filter(Boolean)
    .join('\n')

  return { poster, posters, angles, clip, script }
}

// Lấy các dòng phụ đề từ kịch bản AI trả về
export function extractCaptions(text = '') {
  const lines = text.split('\n').map((l) => l.trim())
  const at = lines.findIndex((l) => /^phụ đề/i.test(l))
  const body = at >= 0 ? lines.slice(at + 1) : lines
  return body
    .filter((l) => /^[-•*]/.test(l) || at < 0)
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter((l) => l && !/^lời đọc/i.test(l))
}
