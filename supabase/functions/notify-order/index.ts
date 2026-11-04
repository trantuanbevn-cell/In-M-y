// Báo đơn hàng mới về Telegram. Khóa nằm trong Supabase secrets:
// TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID. Gọi sau khi khách tạo đơn; mỗi đơn chỉ báo một lần.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chat = Deno.env.get('TELEGRAM_CHAT_ID')
  if (!token || !chat) return json({ ok: false, skipped: 'missing_telegram_secrets' })

  let id = ''
  try {
    id = String((await req.json()).order_id || '')
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'bad id' }, 400)

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  // Chỉ đơn mới trong 15 phút và chưa báo; đánh dấu trước để không báo trùng
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data: o } = await sb
    .from('orders')
    .update({ notified_at: new Date().toISOString() })
    .eq('id', id)
    .is('notified_at', null)
    .gte('created_at', since)
    .select('*')
    .maybeSingle()
  if (!o) return json({ ok: true, skipped: 'already_or_old' })

  const site = Deno.env.get('SITE_URL') || 'https://inmay.vercel.app'
  const text = [
    `🛎 <b>Đơn mới InMây</b>`,
    `Sản phẩm: <b>${esc(o.product_name)}</b> × ${esc(o.quantity)}`,
    `Khách: ${esc(o.customer_name)}`,
    `Điện thoại: <b>${esc(o.customer_phone)}</b>`,
    o.customer_email ? `Email: ${esc(o.customer_email)}` : '',
    o.customer_address ? `Địa chỉ: ${esc(o.customer_address)}` : '',
    o.notes ? `Ghi chú: ${esc(o.notes)}` : '',
    `Xem đơn: ${site}/admin`,
  ]
    .filter(Boolean)
    .join('\n')

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  })
  if (!r.ok) {
    await sb.from('orders').update({ notified_at: null }).eq('id', id)
    return json({ ok: false, error: 'telegram_failed', status: r.status }, 502)
  }
  return json({ ok: true })
})
