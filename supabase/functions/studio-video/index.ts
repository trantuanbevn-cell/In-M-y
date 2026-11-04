// Tạo clip video bằng Gemini Omni Flash (ảnh → video) qua Interactions API, chạy nền.
// start: gửi việc, poll: hỏi kết quả, xong thì lưu video vào kho và thêm vào dự án.
// Khóa GEMINI_API_KEY nằm trong Supabase secrets. Chỉ admin gọi được.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const API = 'https://generativelanguage.googleapis.com/v1beta/interactions'
const MODEL = Deno.env.get('GEMINI_VIDEO_MODEL') || 'gemini-omni-1.1-flash'
const RES = ['360p', '720p', '1080p']

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
    const seconds = Math.min(10, Math.max(3, Math.round(Number(body.seconds) || 5)))
    const resolution = RES.includes(body.resolution) ? body.resolution : '720p'
    const text = `${seconds} second, ${aspect} video. Use the image as the first frame. ${prompt}`
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        model: MODEL,
        input: [
          { type: 'image', data: im.data, mime_type: im.mime },
          { type: 'text', text },
        ],
        response_format: { type: 'video', aspect_ratio: aspect, resolution, duration: `${seconds}s` },
        generation_config: { video_config: { task: 'image_to_video' } },
        background: true,
      }),
    })
    const raw = await r.json().catch(() => ({}))
    if (!r.ok || !raw?.id) return json({ error: 'gemini_error', message: raw?.error?.message || `HTTP ${r.status}` }, 502)
    return json({ ok: true, id: raw.id, status: raw.status, seconds, resolution, immediate: raw.status === 'completed' })
  }

  if (body.action === 'poll') {
    const id = String(body.id || '')
    const projectId = String(body.project_id || '')
    if (!/^[\w\-.]+$/.test(id) || !/^[0-9a-f-]{36}$/.test(projectId)) return json({ error: 'Tham số không hợp lệ.' }, 400)
    const r = await fetch(`${API}/${id}`, { headers: { 'x-goog-api-key': key } })
    const raw = await r.json().catch(() => ({}))
    if (!r.ok) return json({ error: 'gemini_error', message: raw?.error?.message || `HTTP ${r.status}` }, 502)
    const st = String(raw.status || '')
    if (st === 'failed' || st === 'cancelled' || st === 'incomplete')
      return json({ error: 'gemini_error', message: `Video thất bại (${st}). ${raw.error?.message || ''}`.trim() }, 502)
    const vid = (raw.steps || [])
      .filter((s: any) => s.type === 'model_output')
      .flatMap((s: any) => s.content || [])
      .find((c: any) => c.type === 'video')
    if (st !== 'completed' || !vid) return json({ ok: true, done: false, status: st })

    let bytes: Uint8Array
    if (vid.data) {
      const bin = atob(vid.data)
      bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    } else if (vid.uri) {
      const dl = await fetch(vid.uri, { headers: { 'x-goog-api-key': key }, redirect: 'follow' })
      if (!dl.ok) return json({ error: 'download_failed', message: `Không tải được video (HTTP ${dl.status}).` }, 502)
      bytes = new Uint8Array(await dl.arrayBuffer())
    } else return json({ error: 'no_video', message: 'Google không trả dữ liệu video.' }, 502)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const path = `${projectId}/video/${Date.now()}-ai.mp4`
    const up = await admin.storage.from('studio-media').upload(path, bytes, { contentType: vid.mime_type || 'video/mp4' })
    if (up.error) return json({ error: 'storage_error', message: up.error.message }, 500)
    const url = admin.storage.from('studio-media').getPublicUrl(path).data.publicUrl
    const ins = await admin.from('studio_assets').insert({ project_id: projectId, kind: 'video', url, storage_path: path, approved: false })
    if (ins.error) return json({ error: 'db_error', message: ins.error.message }, 500)
    return json({ ok: true, done: true, url, path })
  }
  return json({ error: 'Thao tác không hợp lệ.' }, 400)
})
