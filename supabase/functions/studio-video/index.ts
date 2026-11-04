// Tạo clip video bằng Google Veo (ảnh → video). Hai thao tác: start (gửi việc) và poll (hỏi kết quả, xong thì lưu vào kho).
// Khóa GEMINI_API_KEY nằm trong Supabase secrets. Chỉ admin gọi được.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const API = 'https://generativelanguage.googleapis.com/v1beta'
const MODELS: Record<string, string> = {
  lite: 'veo-3.1-lite-generate-preview',
  fast: 'veo-3.1-fast-generate-preview',
  pro: 'veo-3.1-generate-preview',
}

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

  if (body.action === 'start') {
    const prompt = String(body.prompt || '').slice(0, 2000)
    const im = body.image
    if (prompt.length < 10) return json({ error: 'Thiếu câu lệnh.' }, 400)
    if (!im?.data || im.data.length > 6_000_000 || !/^image\/(jpeg|png|webp)$/.test(im.mime || ''))
      return json({ error: 'Ảnh đầu vào không hợp lệ hoặc quá lớn.' }, 400)
    const aspect = body.aspect === '16:9' ? '16:9' : '9:16'
    const seconds = [4, 6, 8].includes(Number(body.seconds)) ? Number(body.seconds) : 6
    const resolution = body.resolution === '1080p' && aspect === '16:9' ? '1080p' : '720p'
    const model = MODELS[body.model] || MODELS.lite
    const payload = {
      instances: [{ prompt, image: { bytesBase64Encoded: im.data, mimeType: im.mime } }],
      parameters: { aspectRatio: aspect, durationSeconds: seconds, resolution },
    }
    const r = await fetch(`${API}/models/${model}:predictLongRunning`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(payload),
    })
    const raw = await r.json().catch(() => ({}))
    if (!r.ok || !raw?.name) return json({ error: 'gemini_error', message: raw?.error?.message || `HTTP ${r.status}` }, 502)
    return json({ ok: true, operation: raw.name, model, seconds, resolution })
  }

  if (body.action === 'poll') {
    const op = String(body.operation || '')
    const projectId = String(body.project_id || '')
    if (!/^models\/[\w.\-]+\/operations\/[\w\-]+$/.test(op) || !/^[0-9a-f-]{36}$/.test(projectId))
      return json({ error: 'Tham số không hợp lệ.' }, 400)
    const r = await fetch(`${API}/${op}`, { headers: { 'x-goog-api-key': key } })
    const raw = await r.json().catch(() => ({}))
    if (!r.ok) return json({ error: 'gemini_error', message: raw?.error?.message || `HTTP ${r.status}` }, 502)
    if (!raw.done) return json({ ok: true, done: false })
    if (raw.error) return json({ error: 'gemini_error', message: raw.error.message || 'Veo báo lỗi.' }, 502)
    const resp = raw.response || {}
    const sample = resp.generateVideoResponse?.generatedSamples?.[0] || resp.generatedVideos?.[0]
    const uri = sample?.video?.uri
    if (!uri) {
      const why = resp.generateVideoResponse?.raiMediaFilteredReasons?.[0] || 'không rõ'
      return json({ error: 'no_video', message: `Veo không trả video (lý do: ${why}).` }, 502)
    }
    const dl = await fetch(uri, { headers: { 'x-goog-api-key': key }, redirect: 'follow' })
    if (!dl.ok) return json({ error: 'download_failed', message: `Không tải được video từ Google (HTTP ${dl.status}).` }, 502)
    const bytes = new Uint8Array(await dl.arrayBuffer())
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const path = `${projectId}/video/${Date.now()}-veo.mp4`
    const up = await admin.storage.from('studio-media').upload(path, bytes, { contentType: 'video/mp4' })
    if (up.error) return json({ error: 'storage_error', message: up.error.message }, 500)
    const url = admin.storage.from('studio-media').getPublicUrl(path).data.publicUrl
    const ins = await admin.from('studio_assets').insert({ project_id: projectId, kind: 'video', url, storage_path: path, approved: false })
    if (ins.error) return json({ error: 'db_error', message: ins.error.message }, 500)
    return json({ ok: true, done: true, url, path })
  }
  return json({ error: 'Thao tác không hợp lệ.' }, 400)
})
