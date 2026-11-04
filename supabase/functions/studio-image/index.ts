// Tạo ảnh poster / ảnh góc bằng Gemini (Nano Banana) từ ảnh sản phẩm thật + câu lệnh.
// Khóa GEMINI_API_KEY nằm trong Supabase secrets. Chỉ admin gọi được.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9', '4:5', '5:4', '2:3', '3:2']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
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
  const prompt = String(body.prompt || '').slice(0, 6000)
  if (prompt.length < 20) return json({ error: 'Thiếu câu lệnh.' }, 400)
  const images = Array.isArray(body.images) ? body.images.slice(0, 3) : []
  for (const im of images) {
    if (typeof im?.data !== 'string' || im.data.length > 4_000_000 || !/^image\/(jpeg|png|webp)$/.test(im.mime || ''))
      return json({ error: 'Ảnh tham chiếu không hợp lệ hoặc quá lớn.' }, 400)
  }
  const aspect = RATIOS.includes(body.aspect) ? body.aspect : '1:1'
  const model = Deno.env.get('GEMINI_IMAGE_MODEL') || 'gemini-3.1-flash-image'

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [...images.map((im: any) => ({ inlineData: { mimeType: im.mime, data: im.data } })), { text: prompt }],
      },
    ],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect, imageSize: '1K' } },
  }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(payload),
  })
  const raw = await r.json().catch(() => ({}))
  if (!r.ok) return json({ error: 'gemini_error', message: raw?.error?.message || `HTTP ${r.status}` }, 502)
  const parts = raw?.candidates?.[0]?.content?.parts || []
  const img = parts.find((p: any) => p.inlineData?.data || p.inline_data?.data)
  const d = img?.inlineData || img?.inline_data
  if (!d) {
    const why = raw?.candidates?.[0]?.finishReason || raw?.promptFeedback?.blockReason || 'không rõ'
    const txt = parts.map((p: any) => p.text || '').join(' ').slice(0, 300)
    return json({ error: 'no_image', message: `AI không trả ảnh (lý do: ${why}). ${txt}`.trim() }, 502)
  }
  return json({ ok: true, model, mime: d.mimeType || d.mime_type || 'image/png', data: d.data })
})
