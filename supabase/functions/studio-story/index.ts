// AI nhìn ảnh sản phẩm và đề xuất cốt truyện + concept quảng cáo.
// Khóa GEMINI_API_KEY nằm trong Supabase secrets, không bao giờ ra trình duyệt.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const S = { type: 'STRING' }
const arr = (items: unknown) => ({ type: 'ARRAY', items })
const schema = {
  type: 'OBJECT',
  properties: {
    product_guess: {
      type: 'OBJECT',
      properties: { name: S, category: S, material: S, description: S, tags: arr(S) },
      required: ['name', 'description'],
    },
    concepts: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: S,
          logic: S,
          story: S,
          setting_en: S,
          props_en: arr(S),
          mood_en: S,
          palette_en: S,
          poster_headline: S,
          poster_tagline: S,
          badges: arr(S),
          cta: S,
          angle_shots: arr({ type: 'OBJECT', properties: { label: S, prompt_en: S }, required: ['label', 'prompt_en'] }),
          storyboard: arr({ type: 'OBJECT', properties: { shot: S, motion_en: S }, required: ['shot', 'motion_en'] }),
          voiceover: S,
          captions: arr(S),
          page_story: S,
          events: arr(S),
          hashtags: arr(S),
        },
        required: [
          'title', 'logic', 'story', 'setting_en', 'props_en', 'mood_en', 'palette_en', 'poster_headline',
          'poster_tagline', 'badges', 'cta', 'angle_shots', 'storyboard', 'voiceover', 'captions', 'page_story',
        ],
      },
    },
  },
  required: ['product_guess', 'concepts'],
}

const SYSTEM = `Bạn là đạo diễn sáng tạo kiêm copywriter cho "InMây", shop bán sản phẩm cá nhân hoá in 3D tại Việt Nam (slogan "In những giấc mơ"). Khách hàng: học sinh, trẻ em, sinh viên, người thích đồ độc bản.
Nhiệm vụ: nhìn ảnh sản phẩm THẬT, hiểu nó là gì, dùng cho ai, cảm xúc nó gợi lên, rồi đề xuất đúng 3 cốt truyện quảng cáo KHÁC HẲN nhau (khác bối cảnh, khác cảm xúc, khác đối tượng).
Mỗi cốt truyện phải có logic thuyết phục gắn với chính sản phẩm, KHÔNG chọn nền ngẫu nhiên. Ví dụ đèn nấm: một góc phòng ngủ đêm khuya như khu rừng thần tiên có đom đóm, đèn là cây nấm phát sáng dẫn lối giấc mơ.
Quy tắc:
- Văn bản hiển thị cho khách (title, story, poster_headline, poster_tagline, badges, cta, voiceover, captions, page_story) viết tiếng Việt có dấu, tự nhiên, không phóng đại, không hứa điều không có thật, không bịa giá/khuyến mãi/thông số.
- Các trường *_en là tiếng Anh, mô tả cụ thể cho AI tạo ảnh: bố cục, ánh sáng, đạo cụ, màu sắc. Sản phẩm phải là nhân vật chính, giữ nguyên hình dáng và màu như ảnh thật.
- angle_shots: đúng 3 ảnh (ví dụ góc 45 độ trong bối cảnh, cận cảnh chi tiết, bố cục nhìn từ trên). prompt_en mô tả cảnh trong cốt truyện, không có chữ trong ảnh.
- storyboard: 4 cảnh video dọc 9:16, mỗi cảnh một chuyển động camera đơn giản (motion_en).
- voiceover: 2 đến 4 câu ngắn, đọc khoảng 15 đến 20 giây. captions: 4 đến 6 dòng, mỗi dòng tối đa 8 từ.
- poster_headline tối đa 6 từ, viết hoa. badges tối đa 3, mỗi huy hiệu tối đa 4 từ.
- page_story: một đoạn 2 đến 3 câu đưa lên trang sản phẩm.
- events: các dịp lễ hội Việt Nam trong năm hợp với cốt truyện (có thể để trống).
Nếu người dùng nhập ngữ cảnh, dịp hoặc ghi chú thì ưu tiên theo đó.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization') || ''
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: isAdmin, error: authErr } = await sb.rpc('is_admin')
  if (authErr || isAdmin !== true) return json({ error: 'Chỉ quản trị viên được dùng chức năng này.' }, 403)

  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'missing_key', message: 'Chưa cài GEMINI_API_KEY trong Supabase secrets.' }, 501)

  let body: any
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON không hợp lệ' }, 400)
  }
  const images = Array.isArray(body.images) ? body.images.slice(0, 4) : []
  if (!images.length) return json({ error: 'Cần ít nhất một ảnh sản phẩm.' }, 400)
  for (const im of images) {
    if (typeof im?.data !== 'string' || im.data.length > 4_000_000 || !/^image\/(jpeg|png|webp)$/.test(im.mime || ''))
      return json({ error: 'Ảnh không hợp lệ hoặc quá lớn.' }, 400)
  }
  const info = body.info || {}
  const hint = [
    info.name ? `Tên sản phẩm shop đặt: ${info.name}` : '',
    info.description ? `Mô tả của shop: ${info.description}` : '',
    info.specs ? `Thông số: ${JSON.stringify(info.specs)}` : '',
    body.event ? `Dịp / chiến dịch muốn nhắm tới: ${body.event}` : '',
    body.note ? `Ghi chú của chủ shop: ${body.note}` : '',
    body.avoid ? `Không dùng ý tưởng sau (đã có): ${body.avoid}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash'
  const payload = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: 'user',
        parts: [
          ...images.map((im: any) => ({ inlineData: { mimeType: im.mime, data: im.data } })),
          { text: (hint || 'Chưa có thông tin thêm, hãy tự nhìn ảnh.') + '\nHãy trả về JSON đúng schema.' },
        ],
      },
    ],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 1 },
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload),
  })
  const raw = await r.json().catch(() => ({}))
  if (!r.ok) return json({ error: 'gemini_error', message: raw?.error?.message || `HTTP ${r.status}` }, 502)
  const text = raw?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || '').join('') || ''
  try {
    const out = JSON.parse(text)
    return json({ ok: true, model, ...out })
  } catch {
    return json({ error: 'parse_error', message: 'AI trả về không đúng định dạng, hãy thử lại.' }, 502)
  }
})
