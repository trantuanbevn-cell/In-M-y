// Dựng video slideshow ngay trong trình duyệt: canvas + MediaRecorder (không cần máy chủ).
// Chạy theo thời gian thực: video dài 15 giây thì dựng mất ~15 giây, cần giữ tab mở.

const pickMime = () => {
  const list = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ]
  return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || ''
}

const loadBitmap = async (url) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Không tải được ảnh: ' + url)
  return createImageBitmap(await res.blob())
}

const ease = (t) => t * t * (3 - 2 * t)

function drawCover(ctx, img, W, H, zoom, panX) {
  const s = Math.max(W / img.width, H / img.height) * zoom
  const w = img.width * s
  const h = img.height * s
  const x = (W - w) / 2 + panX * W
  const y = (H - h) / 2
  ctx.drawImage(img, x, y, w, h)
}

function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur)
      cur = w
    } else cur = t
  }
  if (cur) lines.push(cur)
  return lines
}

function drawCaption(ctx, text, W, H, style) {
  if (!text) return
  const size = Math.round(Math.min(W, H) * 0.065)
  ctx.font = `800 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = wrap(ctx, text, W * 0.84)
  const lh = size * 1.25
  const y0 = H * 0.74 - ((lines.length - 1) * lh) / 2
  ctx.save()
  lines.forEach((ln, i) => {
    const y = y0 + i * lh
    if (style === 'minimal') {
      ctx.shadowColor = 'rgba(0,0,0,.6)'
      ctx.shadowBlur = 8
      ctx.fillStyle = '#fff'
      ctx.font = `600 ${Math.round(size * 0.8)}px system-ui, sans-serif`
      ctx.fillText(ln, W / 2, y)
    } else if (style === 'cute') {
      const w = ctx.measureText(ln).width + size
      ctx.fillStyle = 'rgba(255,236,245,.92)'
      ctx.beginPath()
      ctx.roundRect(W / 2 - w / 2, y - lh / 2, w, lh, lh / 2)
      ctx.fill()
      ctx.fillStyle = '#d6407a'
      ctx.fillText(ln, W / 2, y)
    } else if (style === 'neon') {
      ctx.shadowColor = '#00e5ff'
      ctx.shadowBlur = 22
      ctx.fillStyle = '#e8fdff'
      ctx.fillText(ln, W / 2, y)
      ctx.fillText(ln, W / 2, y)
    } else {
      ctx.lineJoin = 'round'
      ctx.lineWidth = size * 0.22
      ctx.strokeStyle = '#000'
      ctx.strokeText(ln, W / 2, y)
      ctx.fillStyle = '#ffd400'
      ctx.fillText(ln, W / 2, y)
    }
  })
  ctx.restore()
}

/**
 * options:
 *  images: mảng URL ảnh (theo thứ tự)
 *  ratio: { w, h }  (tỉ lệ khung hình, ví dụ 1080x1920)
 *  shortSide: số px cạnh ngắn của video xuất ra (720 mặc định)
 *  secondsPerImage, motion: 'zoom_in' | 'pan' | 'fast_cuts'
 *  captions: mảng dòng phụ đề; captionStyle: 'tiktok' | 'minimal' | 'cute' | 'neon'
 *  audioFile: File nhạc (tuỳ chọn) | audioUrl
 *  onProgress(0..1)
 */
export async function renderSlideshow(opt) {
  const {
    images,
    ratio = { w: 1080, h: 1920 },
    shortSide = 720,
    motion = 'zoom_in',
    captions = [],
    captionStyle = 'tiktok',
    audioFile = null,
    audioUrl = null,
    onProgress = () => {},
    fps = 30,
  } = opt
  if (!images?.length) throw new Error('Chưa chọn ảnh nào để dựng video.')
  if (!window.MediaRecorder) throw new Error('Trình duyệt này không hỗ trợ dựng video. Hãy dùng Chrome hoặc Edge.')

  const k = shortSide / Math.min(ratio.w, ratio.h)
  const W = Math.round((ratio.w * k) / 2) * 2
  const H = Math.round((ratio.h * k) / 2) * 2

  let secondsPerImage = motion === 'fast_cuts' ? 1.3 : opt.secondsPerImage || 2.5
  // Shopee/TikTok cần tối thiểu ~5 giây
  if (secondsPerImage * images.length < 5) secondsPerImage = 5 / images.length
  const total = secondsPerImage * images.length
  const fade = Math.min(0.45, secondsPerImage / 3)

  const bitmaps = []
  for (let i = 0; i < images.length; i++) {
    bitmaps.push(await loadBitmap(images[i]))
    onProgress(0.05 * ((i + 1) / images.length))
  }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const frameAt = (img, local, i) => {
    const t = Math.min(1, Math.max(0, local / secondsPerImage))
    if (motion === 'pan') drawCover(ctx, img, W, H, 1.12, (i % 2 ? 1 : -1) * (0.04 - 0.08 * ease(t)))
    else if (motion === 'fast_cuts') drawCover(ctx, img, W, H, 1.0 + 0.1 * Math.sin(Math.PI * t), 0)
    else drawCover(ctx, img, W, H, 1.0 + 0.14 * ease(t), 0)
  }

  const stream = canvas.captureStream(fps)
  let audioCtx = null
  let src = null
  let gain = null
  if (audioFile || audioUrl) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const buf = audioFile ? await audioFile.arrayBuffer() : await (await fetch(audioUrl)).arrayBuffer()
      const decoded = await audioCtx.decodeAudioData(buf)
      src = audioCtx.createBufferSource()
      src.buffer = decoded
      src.loop = decoded.duration < total
      gain = audioCtx.createGain()
      gain.gain.value = 0.9
      const dest = audioCtx.createMediaStreamDestination()
      src.connect(gain).connect(dest)
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr))
    } catch (e) {
      audioCtx = null
      src = null
      console.warn('Không đọc được nhạc nền, dựng không có tiếng', e)
    }
  }

  const mime = pickMime()
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: shortSide >= 1080 ? 8e6 : 5e6 })
  const chunks = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  const stopped = new Promise((res) => (rec.onstop = res))

  rec.start(250)
  if (src) src.start()
  const t0 = performance.now()

  await new Promise((resolve) => {
    const tick = () => {
      const el = (performance.now() - t0) / 1000
      if (el >= total) return resolve()
      const i = Math.min(images.length - 1, Math.floor(el / secondsPerImage))
      const local = el - i * secondsPerImage
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      if (i > 0 && local < fade) {
        frameAt(bitmaps[i - 1], secondsPerImage, i - 1)
        ctx.globalAlpha = ease(local / fade)
        frameAt(bitmaps[i], local, i)
        ctx.globalAlpha = 1
      } else frameAt(bitmaps[i], local, i)
      if (captions.length) {
        const ci = Math.min(captions.length - 1, Math.floor((el / total) * captions.length))
        drawCaption(ctx, captions[ci], W, H, captionStyle)
      }
      if (gain && total - el < 1) gain.gain.value = Math.max(0, (total - el) * 0.9)
      onProgress(0.05 + 0.95 * (el / total))
      requestAnimationFrame(tick)
    }
    tick()
  })

  rec.stop()
  await stopped
  try {
    src?.stop()
    audioCtx?.close()
  } catch {
    /* bỏ qua */
  }
  bitmaps.forEach((b) => b.close?.())
  const type = rec.mimeType || mime || 'video/webm'
  const blob = new Blob(chunks, { type })
  onProgress(1)
  return { blob, type, ext: type.includes('mp4') ? 'mp4' : 'webm', seconds: total, width: W, height: H }
}
