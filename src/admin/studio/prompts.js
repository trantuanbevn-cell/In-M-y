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

export function buildPrompts({ project, product, options }) {
  const sel = project.selections || {}
  const P = (k) => picked(sel, options, k)
  const name = product?.name || project.title
  const scene = list(P('scene')).join('; ') || 'a clean, attractive background that suits the product'
  const audience = list(P('audience')).join('; ')
  const style = list(P('poster_style')).join('; ') || 'a clean, eye-catching promotional poster'
  const badges = list(P('badge'))
  const cta = list(P('cta'))[0]
  const ratio = list(P('ratio'))[0] || '1:1'
  const free = (project.free_text || '').trim()
  const title = (project.poster_title || '').trim()

  const poster = [
    `Create a promotional poster for "InMây", a shop selling personalized 3D-printed products (tagline: "In những giấc mơ").`,
    `Use the attached reference photos as the REAL products. Keep their exact shape, colors and details. Do not redraw them or invent different products.`,
    `Product: ${name}${product?.description ? ` — ${product.description}` : ''}.`,
    title ? `Large poster title (Vietnamese, spell exactly, keep all diacritics): "${title}".` : '',
    `Poster style: ${style}.`,
    `Scene and background: ${scene}.`,
    audience ? `Target audience: ${audience}.` : '',
    badges.length ? `Promo badges (render this exact Vietnamese text): ${badges.map((b) => `"${b}"`).join(', ')}.` : '',
    cta ? `Call-to-action ribbon (exact text): "${cta}".` : '',
    `Aspect ratio: ${ratio}.`,
    free ? `Extra instructions: ${free}` : '',
    `All text must be spelled exactly as given with Vietnamese diacritics preserved. No watermarks, no extra logos.`,
  ]
    .filter(Boolean)
    .join('\n')

  const angleBase = (view) =>
    [
      `Using the attached reference photos of the real product "${name}", create a lifestyle product image.`,
      `Keep the product's exact shape, colors and details unchanged.`,
      `Camera view: ${view}.`,
      `Scene and background: ${scene}.`,
      audience ? `Mood for audience: ${audience}.` : '',
      `Aspect ratio: ${ratio}. No text, no watermark.`,
      free ? `Extra instructions: ${free}` : '',
    ]
      .filter(Boolean)
      .join('\n')

  const angles = [
    { label: 'Ảnh góc 45° trong bối cảnh', prompt: angleBase('three-quarter 45-degree angle, product in focus, soft depth of field') },
    { label: 'Ảnh cận chi tiết', prompt: angleBase('macro close-up showing surface detail and print texture') },
    { label: 'Ảnh nhìn từ trên xuống', prompt: angleBase('top-down flat-lay composition with a few matching props') },
  ]

  const motions = list(P('motion')).join('; ') || 'slow cinematic push-in on the product'
  const music = list(P('music'))[0]
  const clip = [
    `Animate the attached image into a short vertical video clip (about 6 seconds, 9:16).`,
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

  return { poster, angles, clip, script }
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
