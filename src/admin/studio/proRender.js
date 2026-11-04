// Bộ dựng video kiểu TikTok chạy trong trình duyệt: WebGL (chuyển cảnh GL Transitions + hiệu ứng) + Mediabunny (xuất MP4 bằng WebCodecs).
// Dựng từng khung hình, nhanh hơn thời gian thực, và có âm thanh tổng hợp (nhạc nền, tiếng hiệu ứng, tiếng clip AI).
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, canEncodeAudio, canEncodeVideo } from 'mediabunny'

// Sau mỗi lần cập nhật web, tab đang mở có thể còn trỏ tới tệp cũ đã bị thay: tự tải lại trang một lần.
async function loadGlt() {
  try {
    return await import('gl-transitions')
  } catch (e) {
    if (!sessionStorage.getItem('inmay-reloaded')) {
      sessionStorage.setItem('inmay-reloaded', '1')
      location.reload()
      await new Promise(() => {})
    }
    throw new Error('Web vừa được cập nhật. Hãy bấm Ctrl+F5 để tải lại rồi dựng video lại.')
  }
}


export const canProRender = () => typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' && !!window.OffscreenCanvas

const ease = (t) => t * t * (3 - 2 * t)
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const easeOutBack = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/* ---------- tải nguồn ---------- */
async function loadSegment(s) {
  const res = await fetch(s.url)
  if (!res.ok) throw new Error('Không tải được tệp: ' + s.url)
  const blob = await res.blob()
  if (s.type === 'video') {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'auto'
    v.src = URL.createObjectURL(blob)
    await new Promise((ok, bad) => {
      v.onloadeddata = ok
      v.onerror = () => bad(new Error('Không đọc được clip video.'))
    })
    return { ...s, el: v, dur: Math.min(s.maxDur || 10, v.duration || 5), audio: await blob.arrayBuffer(), objectUrl: v.src }
  }
  return { ...s, el: await createImageBitmap(blob), dur: s.dur }
}

function drawCover(ctx, el, W, H, zoom, panX, panY = 0, rot = 0) {
  const iw = el.videoWidth || el.width
  const ih = el.videoHeight || el.height
  const s = Math.max(W / iw, H / ih) * zoom
  const w = iw * s
  const h = ih * s
  ctx.save()
  ctx.translate(W / 2 + panX * W, H / 2 + panY * H)
  if (rot) ctx.rotate(rot)
  ctx.drawImage(el, -w / 2, -h / 2, w, h)
  ctx.restore()
}

async function seekTo(v, t) {
  if (Math.abs(v.currentTime - t) < 0.001 && v.readyState >= 2) return
  await new Promise((res) => {
    const done = () => {
      v.removeEventListener('seeked', done)
      clearTimeout(to)
      res()
    }
    const to = setTimeout(done, 2500)
    v.addEventListener('seeked', done)
    v.currentTime = t
  })
}

/* ---------- WebGL ---------- */
const VERT = 'attribute vec2 a; varying vec2 _uv; void main(){ _uv = a*0.5+0.5; gl_Position = vec4(a,0.0,1.0); }'
const transFrag = (glsl) => `precision highp float; precision highp int;
uniform sampler2D from, to; uniform float progress, ratio; varying vec2 _uv;
vec4 getFromColor(vec2 uv){ return texture2D(from, uv); }
vec4 getToColor(vec2 uv){ return texture2D(to, uv); }
${glsl}
void main(){ gl_FragColor = transition(_uv); }`

const FX_FRAG = `precision highp float; varying vec2 _uv; uniform sampler2D tex; uniform vec2 res;
uniform float time, beat, flash, shake, pulse, rgb, glitch, vignette, grain, vhs, grade;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 uv = _uv;
  float z = 1.0 - pulse * 0.055 * beat;
  uv = (uv - 0.5) * z + 0.5;
  uv += shake * 0.011 * vec2(sin(time*53.0) + sin(time*91.0), cos(time*47.0) + cos(time*83.0)) * (0.35 + beat);
  if (glitch > 0.0) {
    float band = floor(uv.y * 26.0);
    float r = hash(vec2(band, floor(time * 12.0)));
    if (r > 0.92) uv.x += (hash(vec2(band, time)) - 0.5) * 0.14 * glitch;
  }
  float ab = rgb * (0.004 + 0.012 * beat);
  vec3 c;
  c.r = texture2D(tex, uv + vec2(ab, 0.0)).r;
  c.g = texture2D(tex, uv).g;
  c.b = texture2D(tex, uv - vec2(ab, 0.0)).b;
  if (vhs > 0.0) {
    c *= 0.9 + 0.1 * sin(uv.y * res.y * 1.4);
    c += vhs * 0.05 * (hash(vec2(floor(uv.y * res.y / 2.0), time)) - 0.5);
    c.r += vhs * 0.03 * sin(uv.y * 40.0 + time * 6.0);
  }
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  if (abs(grade - 1.0) < 0.5) c *= vec3(1.08, 1.0, 0.9);
  else if (abs(grade - 2.0) < 0.5) c *= vec3(0.92, 1.0, 1.1);
  else if (abs(grade - 3.0) < 0.5) c = mix(vec3(l), c, 1.35);
  else if (abs(grade - 4.0) < 0.5) { c = mix(vec3(l), c, 0.9); c = mix(c, vec3(1.0, 0.9, 0.95), 0.14) + 0.03; }
  else if (abs(grade - 5.0) < 0.5) { c = mix(vec3(l), c, 0.8) * vec3(0.88, 0.84, 1.06) - 0.03; }
  else if (abs(grade - 6.0) < 0.5) c = vec3(l);
  float d = distance(_uv, vec2(0.5));
  c *= 1.0 - vignette * smoothstep(0.32, 0.85, d) * 0.75;
  c += grain * (hash(_uv * res + time) - 0.5) * 0.2;
  c = mix(c, vec3(1.0), flash);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

function makeGL(W, H) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false }) || canvas.getContext('webgl', { preserveDrawingBuffer: true })
  if (!gl) throw new Error('Trình duyệt không bật được WebGL.')
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

  const compile = (type, src) => {
    const sh = gl.createShader(type)
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh)
      gl.deleteShader(sh)
      throw new Error(log || 'shader lỗi')
    }
    return sh
  }
  const program = (frag) => {
    const p = gl.createProgram()
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT))
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag))
    gl.bindAttribLocation(p, 0, 'a')
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || 'link lỗi')
    return p
  }
  const tex = () => {
    const t = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  const texFrom = tex()
  const texTo = tex()
  const texMid = tex()
  gl.bindTexture(gl.TEXTURE_2D, texMid)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  const fbo = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texMid, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.viewport(0, 0, W, H)

  const upload = (t, src) => {
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src)
  }
  return { canvas, gl, program, upload, texFrom, texTo, texMid, fbo }
}

const setParam = (gl, p, name, type, v) => {
  const loc = gl.getUniformLocation(p, name)
  if (!loc) return
  if (type === 'float') gl.uniform1f(loc, v)
  else if (type === 'int' || type === 'bool') gl.uniform1i(loc, +v)
  else if (type === 'vec2') gl.uniform2fv(loc, v)
  else if (type === 'vec3') gl.uniform3fv(loc, v)
  else if (type === 'vec4') gl.uniform4fv(loc, v)
  else if (type === 'ivec2') gl.uniform2iv(loc, v)
}

/* ---------- chữ và tem ---------- */
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

function drawCaption(ctx, text, W, H, style, anim, k, slot, beat) {
  if (!text) return
  let shown = text
  let scale = 1
  let dy = 0
  let alpha = 1
  const a = clamp(k / 0.28, 0, 1)
  if (anim === 'pop') {
    scale = 0.4 + 0.6 * easeOutBack(a)
    alpha = clamp(k / 0.1, 0, 1)
  } else if (anim === 'slide') {
    dy = (1 - ease(a)) * H * 0.05
    alpha = a
  } else if (anim === 'type') {
    shown = text.slice(0, Math.ceil(text.length * clamp(k / Math.max(0.2, slot * 0.55), 0, 1)))
  } else if (anim === 'beat') {
    scale = 1 + 0.07 * beat
    alpha = clamp(k / 0.1, 0, 1)
  }
  if (!shown) return
  const size = Math.round(Math.min(W, H) * 0.065)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `800 ${size}px system-ui, "Segoe UI", Roboto, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = wrap(ctx, shown, W * 0.84)
  const lh = size * 1.25
  const cy = H * 0.74 + dy
  ctx.translate(W / 2, cy)
  ctx.scale(scale, scale)
  const y0 = -((lines.length - 1) * lh) / 2
  lines.forEach((ln, i) => {
    const y = y0 + i * lh
    if (style === 'minimal') {
      ctx.shadowColor = 'rgba(0,0,0,.6)'
      ctx.shadowBlur = 8
      ctx.fillStyle = '#fff'
      ctx.font = `600 ${Math.round(size * 0.8)}px system-ui, sans-serif`
      ctx.fillText(ln, 0, y)
    } else if (style === 'cute') {
      const w = ctx.measureText(ln).width + size
      ctx.fillStyle = 'rgba(255,236,245,.94)'
      ctx.beginPath()
      ctx.roundRect(-w / 2, y - lh / 2, w, lh, lh / 2)
      ctx.fill()
      ctx.fillStyle = '#d6407a'
      ctx.fillText(ln, 0, y)
    } else if (style === 'neon') {
      ctx.shadowColor = '#00e5ff'
      ctx.shadowBlur = 22
      ctx.fillStyle = '#e8fdff'
      ctx.fillText(ln, 0, y)
      ctx.fillText(ln, 0, y)
    } else {
      ctx.lineJoin = 'round'
      ctx.lineWidth = size * 0.22
      ctx.strokeStyle = '#000'
      ctx.strokeText(ln, 0, y)
      ctx.fillStyle = '#ffd400'
      ctx.fillText(ln, 0, y)
    }
  })
  ctx.restore()
}

function drawBadge(ctx, text, cx, cy, size, bg, fg, scale, rot) {
  if (scale <= 0) return
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.scale(scale, scale)
  ctx.font = `800 ${size}px system-ui, "Segoe UI", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const w = ctx.measureText(text).width + size * 1.2
  const h = size * 1.7
  ctx.shadowColor = 'rgba(0,0,0,.35)'
  ctx.shadowBlur = size * 0.4
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(-w / 2, -h / 2, w, h, h * 0.28)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,.85)'
  ctx.lineWidth = size * 0.09
  ctx.stroke()
  ctx.fillStyle = fg
  ctx.fillText(text, 0, 0)
  ctx.restore()
}

/* ---------- âm thanh tổng hợp ---------- */
function noiseBuf(oc, dur) {
  const b = oc.createBuffer(1, Math.max(1, Math.floor(oc.sampleRate * dur)), oc.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}
function env(g, t, peak, dur, attack = 0.005) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
}
function synth(oc, kind, t, out) {
  const g = oc.createGain()
  g.connect(out)
  const noise = (dur) => {
    const s = oc.createBufferSource()
    s.buffer = noiseBuf(oc, dur)
    return s
  }
  const osc = (type, f0, f1, dur) => {
    const o = oc.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
    return o
  }
  if (kind === 'whoosh') {
    const n = noise(0.6)
    const f = oc.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 1.1
    f.frequency.setValueAtTime(500, t)
    f.frequency.exponentialRampToValueAtTime(4200, t + 0.4)
    n.connect(f).connect(g)
    env(g, t, 0.55, 0.45, 0.12)
    n.start(t)
    n.stop(t + 0.5)
  } else if (kind === 'boom') {
    const o = osc('sine', 130, 38, 0.5)
    o.connect(g)
    env(g, t, 0.95, 0.55, 0.004)
    o.start(t)
    o.stop(t + 0.6)
  } else if (kind === 'pop') {
    const o = osc('sine', 760, 220, 0.1)
    o.connect(g)
    env(g, t, 0.55, 0.12, 0.003)
    o.start(t)
    o.stop(t + 0.15)
  } else if (kind === 'tick') {
    const n = noise(0.05)
    const f = oc.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 3000
    n.connect(f).connect(g)
    env(g, t, 0.4, 0.04, 0.002)
    n.start(t)
    n.stop(t + 0.06)
  } else if (kind === 'ding' || kind === 'outro') {
    ;[1319, 1976].forEach((fr, i) => {
      const o = osc('sine', fr, 0, 1)
      const gg = oc.createGain()
      o.connect(gg).connect(out)
      env(gg, t, i ? 0.18 : 0.32, 1.0, 0.004)
      o.start(t)
      o.stop(t + 1.1)
    })
  } else if (kind === 'sparkle') {
    ;[2093, 2637, 3136, 4186].forEach((fr, i) => {
      const o = osc('triangle', fr, 0, 0.2)
      const gg = oc.createGain()
      o.connect(gg).connect(out)
      env(gg, t + i * 0.06, 0.2, 0.22, 0.004)
      o.start(t + i * 0.06)
      o.stop(t + i * 0.06 + 0.25)
    })
  } else if (kind === 'riser') {
    const st = Math.max(0, t)
    const n = noise(1.1)
    const f = oc.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(300, st)
    f.frequency.exponentialRampToValueAtTime(7000, st + 1.0)
    n.connect(f).connect(g)
    g.gain.setValueAtTime(0.0001, st)
    g.gain.exponentialRampToValueAtTime(0.5, st + 1.0)
    g.gain.linearRampToValueAtTime(0, st + 1.05)
    n.start(st)
    n.stop(st + 1.1)
  }
}

async function buildAudio({ total, musicBuf, music, events, clips, keepClip }) {
  const sr = 44100
  const oc = new OfflineAudioContext(2, Math.ceil(total * sr), sr)
  const master = oc.createGain()
  master.gain.value = 0.95
  master.connect(oc.destination)
  const warnings = []
  let any = false
  if (musicBuf) {
    try {
      const b = await oc.decodeAudioData(musicBuf.slice(0))
      const s = oc.createBufferSource()
      s.buffer = b
      s.loop = b.duration < total
      const g = oc.createGain()
      g.gain.setValueAtTime(music, 0)
      g.gain.setValueAtTime(music, Math.max(0, total - 1))
      g.gain.linearRampToValueAtTime(0, total)
      s.connect(g).connect(master)
      s.start(0)
      any = true
    } catch {
      warnings.push('Không đọc được nhạc nền, video không có nhạc.')
    }
  }
  if (keepClip) {
    for (const c of clips) {
      try {
        const b = await oc.decodeAudioData(c.audio.slice(0))
        const s = oc.createBufferSource()
        s.buffer = b
        const g = oc.createGain()
        g.gain.value = 0.85
        s.connect(g).connect(master)
        s.start(c.start, 0, c.dur)
        any = true
      } catch {
        /* clip không có tiếng */
      }
    }
  }
  for (const e of events) {
    synth(oc, e.kind, e.t, master)
    any = true
  }
  if (!any) return { buffer: null, warnings }
  return { buffer: await oc.startRendering(), warnings }
}

/**
 * opt: {
 *   segments: [{type:'image'|'video', url, dur}], ratio:{w,h}, shortSide, fps, motion,
 *   fx: { transitions[], randomAll, tdur, effects[], grade, sfx[], capStyle, capAnim, bpm, keepClip, stickers[], limitedText, ctaText },
 *   captions[], captionStyle, priceText, audioFile, audioUrl, musicVolume, onProgress
 * }
 */
export async function renderPro(opt) {
  const { segments, ratio = { w: 1080, h: 1920 }, shortSide = 720, fps = 30, motion = 'zoom_in', fx, captions = [], priceText = '', audioFile, audioUrl, musicVolume = 0.8, onProgress = () => {} } = opt
  if (!segments?.length) throw new Error('Chưa chọn ảnh hoặc clip nào để dựng video.')
  if (!canProRender()) throw new Error('Trình duyệt này chưa hỗ trợ dựng nhanh. Hãy dùng Chrome hoặc Edge bản mới.')

  const k = shortSide / Math.min(ratio.w, ratio.h)
  const W = Math.round((ratio.w * k) / 2) * 2
  const H = Math.round((ratio.h * k) / 2) * 2

  if (!(await canEncodeVideo('avc', { width: W, height: H }))) throw new Error('Trình duyệt không mã hoá được H.264 ở kích thước này. Thử Chrome/Edge mới hoặc chọn chất lượng 720.')

  // nạp nguồn
  const segs = []
  for (let i = 0; i < segments.length; i++) {
    segs.push(await loadSegment(segments[i]))
    onProgress(0.05 * ((i + 1) / segments.length))
  }
  // Tổng thời lượng tối thiểu 5 giây (Shopee/TikTok)
  const sumDur = () => segs.reduce((a, s) => a + s.dur, 0)
  if (sumDur() < 5) {
    const extra = 5 / sumDur()
    segs.forEach((s) => {
      if (s.type === 'image') s.dur *= extra
    })
  }
  let t0 = 0
  segs.forEach((s) => {
    s.start = t0
    t0 += s.dur
  })
  const total = t0
  const tdur = segs.length > 1 ? Math.min(fx.tdur || 0.5, Math.min(...segs.map((s) => s.dur)) * 0.8) : 0

  // chuyển cảnh gán cho từng chỗ nối
  const trAll = fx.randomAll ? null : (fx.transitions?.length ? fx.transitions : [])
  let glt = []
  if (segs.length > 1 && (fx.randomAll || trAll.length)) glt = (await loadGlt()).default
  const BLACK = ['EdgeGlow', 'EyeBlink', 'RectangleCover', 'RectangleIris', 'SimpleFlip']
  const pool = glt.filter((x) => !BLACK.includes(x.name))
  const pickT = (i) => {
    if (segs.length < 2) return null
    if (fx.randomAll) return pool[Math.floor(Math.abs(Math.sin(i * 12.9898 + 1) * 43758.5453) % pool.length)]
    if (!trAll.length) return null
    return glt.find((x) => x.name === trAll[i % trAll.length]) || null
  }
  const trans = []
  for (let i = 0; i < segs.length - 1; i++) trans.push(pickT(i))

  // WebGL
  const G = makeGL(W, H)
  const gl = G.gl
  const progs = new Map()
  const getTransProg = (t) => {
    if (progs.has(t.name)) return progs.get(t.name)
    let p = null
    try {
      p = G.program(transFrag(t.glsl))
    } catch (e) {
      console.warn('Chuyển cảnh lỗi, dùng mờ dần thay thế:', t.name, e.message)
    }
    progs.set(t.name, p)
    return p
  }
  const fxProg = G.program(FX_FRAG)
  const gradeIdx = { warm: 1, cool: 2, vivid: 3, dream: 4, moody: 5, bw: 6 }[fx.grade] || 0
  const eff = new Set(fx.effects || [])

  const src = document.createElement('canvas')
  src.width = W
  src.height = H
  const sctx = src.getContext('2d')
  const cA = document.createElement('canvas')
  cA.width = W
  cA.height = H
  const cB = document.createElement('canvas')
  cB.width = W
  cB.height = H
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const octx = out.getContext('2d')

  const mot = fx.motion || motion
  const drawSeg = async (ctx, seg, idx, tAbs) => {
    const local = clamp(tAbs - seg.start, 0, seg.dur)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, W, H)
    const u = clamp(local / seg.dur, 0, 1)
    if (seg.type === 'video') {
      await seekTo(seg.el, Math.min(local, Math.max(0, seg.el.duration - 0.05)))
      drawCover(ctx, seg.el, W, H, 1.0 + 0.04 * ease(u), 0)
    } else if (mot === 'pan') drawCover(ctx, seg.el, W, H, 1.12, (idx % 2 ? 1 : -1) * (0.04 - 0.08 * ease(u)))
    else if (mot === 'fast_cuts') drawCover(ctx, seg.el, W, H, 1.0 + 0.1 * Math.sin(Math.PI * u), 0)
    else if (mot === 'zoom_out') drawCover(ctx, seg.el, W, H, 1.16 - 0.14 * ease(u), 0)
    else if (mot === 'tilt_up') drawCover(ctx, seg.el, W, H, 1.16, 0, 0.05 - 0.1 * ease(u))
    else if (mot === 'orbit') {
      // giả lập quay quanh vật thể từ ảnh tĩnh: lia ngang + xoay nhẹ + nhún, theo một vòng cung
      const a = (u - 0.5) * 2
      drawCover(ctx, seg.el, W, H, 1.22 + 0.04 * (1 - a * a), a * 0.09, 0.012 * (1 - a * a), a * 0.07)
    } else if (mot === 'none') drawCover(ctx, seg.el, W, H, 1.0, 0)
    else drawCover(ctx, seg.el, W, H, 1.0 + 0.14 * ease(u), 0)
  }

  // sự kiện âm thanh
  const sfx = new Set(fx.sfx || [])
  const events = []
  const trTimes = trans.map((_, i) => segs[i].start + segs[i].dur)
  const capSlot = captions.length ? total / captions.length : 0
  for (const bt of trTimes) {
    if (sfx.has('whoosh')) events.push({ kind: 'whoosh', t: Math.max(0, bt - tdur / 2) })
    if (sfx.has('boom')) events.push({ kind: 'boom', t: bt })
    if (sfx.has('sparkle')) events.push({ kind: 'sparkle', t: bt - 0.1 })
  }
  if (captions.length) {
    for (let i = 0; i < captions.length; i++) {
      if (sfx.has('pop')) events.push({ kind: 'pop', t: i * capSlot })
      if (sfx.has('tick')) events.push({ kind: 'tick', t: i * capSlot })
    }
  }
  if (sfx.has('intro')) events.push({ kind: 'ding', t: 0.05 })
  if (sfx.has('riser')) events.push({ kind: 'riser', t: total - 1.05 })
  if (sfx.has('outro')) events.push({ kind: 'outro', t: Math.max(0, total - 1.1) })

  // chuẩn bị đầu ra
  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() })
  const vsrc = new CanvasSource(out, { codec: 'avc', bitrate: shortSide >= 1080 ? 8e6 : shortSide <= 400 ? 1.5e6 : 5e6 })
  output.addVideoTrack(vsrc, { frameRate: fps })
  const warnings = []
  let musicBuf = null
  if (audioFile) musicBuf = await audioFile.arrayBuffer()
  else if (audioUrl) musicBuf = await (await fetch(audioUrl)).arrayBuffer()
  const aud = await buildAudio({
    total,
    musicBuf,
    music: musicVolume,
    events,
    clips: segs.filter((s) => s.type === 'video').map((s) => ({ audio: s.audio, start: s.start, dur: s.dur })),
    keepClip: fx.keepClip,
  })
  warnings.push(...aud.warnings)
  let asrc = null
  if (aud.buffer) {
    if (await canEncodeAudio('aac')) {
      asrc = new AudioBufferSource({ codec: 'aac', bitrate: 128e3 })
      output.addAudioTrack(asrc)
    } else warnings.push('Trình duyệt không mã hoá được âm thanh, video không có tiếng.')
  }
  await output.start()

  const bpm = fx.bpm || 110
  const nFrames = Math.ceil(total * fps)
  const capIdx = (t) => Math.min(captions.length - 1, Math.floor(t / capSlot))
  const stk = new Set(fx.stickers || [])

  for (let f = 0; f < nFrames; f++) {
    const t = f / fps
    // chọn khung nguồn
    let tr = -1
    let p = 0
    for (let i = 0; i < trans.length; i++) {
      if (trans[i] && Math.abs(t - trTimes[i]) < tdur / 2) {
        tr = i
        p = (t - trTimes[i]) / tdur + 0.5
        break
      }
    }
    let idx = segs.findIndex((s) => t >= s.start && t < s.start + s.dur)
    if (idx < 0) idx = segs.length - 1
    let flash = 0
    let mid = false
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    if (tr >= 0) {
      await drawSeg(cA.getContext('2d'), segs[tr], tr, t)
      await drawSeg(cB.getContext('2d'), segs[tr + 1], tr + 1, t)
      G.upload(G.texFrom, cA)
      G.upload(G.texTo, cB)
      const tp = getTransProg(trans[tr])
      if (tp) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo)
        gl.useProgram(tp)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, G.texFrom)
        gl.uniform1i(gl.getUniformLocation(tp, 'from'), 0)
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, G.texTo)
        gl.uniform1i(gl.getUniformLocation(tp, 'to'), 1)
        gl.uniform1f(gl.getUniformLocation(tp, 'progress'), clamp(p, 0, 1))
        gl.uniform1f(gl.getUniformLocation(tp, 'ratio'), W / H)
        const def = trans[tr].defaultParams || {}
        for (const [n, ty] of Object.entries(trans[tr].paramsTypes || {})) setParam(gl, tp, n, ty, def[n])
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        gl.bindFramebuffer(gl.FRAMEBUFFER, null)
        mid = true
      } else {
        // dự phòng: mờ dần bằng canvas 2D
        sctx.globalAlpha = 1
        sctx.drawImage(cA, 0, 0)
        sctx.globalAlpha = clamp(p, 0, 1)
        sctx.drawImage(cB, 0, 0)
        sctx.globalAlpha = 1
        G.upload(G.texFrom, src)
      }
      if (eff.has('flash')) flash = Math.pow(Math.sin(Math.PI * clamp(p, 0, 1)), 3) * 0.55
    } else {
      await drawSeg(cA.getContext('2d'), segs[idx], idx, t)
      G.upload(G.texFrom, cA)
    }

    const phase = (t * bpm) / 60 - Math.floor((t * bpm) / 60)
    const beat = Math.exp(-phase * 6)
    gl.useProgram(fxProg)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, mid ? G.texMid : G.texFrom)
    const U = (n, v) => gl.uniform1f(gl.getUniformLocation(fxProg, n), v)
    gl.uniform1i(gl.getUniformLocation(fxProg, 'tex'), 0)
    gl.uniform2f(gl.getUniformLocation(fxProg, 'res'), W, H)
    U('time', t)
    U('beat', beat)
    U('flash', flash)
    U('shake', eff.has('shake') ? 1 : 0)
    U('pulse', eff.has('pulse') ? 1 : 0)
    U('rgb', eff.has('rgb') ? 1 : 0)
    U('glitch', eff.has('glitch') ? 1 : 0)
    U('vignette', eff.has('vignette') ? 1 : 0)
    U('grain', eff.has('grain') ? 1 : 0)
    U('vhs', eff.has('vhs') ? 1 : 0)
    U('grade', gradeIdx)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    octx.drawImage(G.canvas, 0, 0)

    // tem
    const base = Math.round(Math.min(W, H) * 0.05)
    const pop = (s, d = 0.35) => (t < s ? 0 : easeOutBack(clamp((t - s) / d, 0, 1)))
    if (stk.has('price') && priceText) drawBadge(octx, priceText, W * 0.27, H * 0.12, base * 1.15, '#ff3d71', '#fff', pop(Math.min(0.8, total * 0.15)) * (1 + 0.04 * beat), -0.1)
    if (stk.has('limited') && fx.limitedText) drawBadge(octx, fx.limitedText, W * 0.7, H * 0.2, base * 0.85, '#ffb300', '#3a2300', pop(total * 0.4), 0.08)
    if (stk.has('cta') && fx.ctaText) drawBadge(octx, fx.ctaText, W / 2, H * 0.9, base * 1.05, '#2563eb', '#fff', pop(Math.max(0, total - 1.8)), 0)
    if (stk.has('logo')) {
      octx.save()
      octx.font = `800 ${Math.round(base * 0.7)}px system-ui, sans-serif`
      octx.textAlign = 'right'
      octx.shadowColor = 'rgba(0,0,0,.5)'
      octx.shadowBlur = 6
      octx.fillStyle = 'rgba(255,255,255,.92)'
      octx.fillText('☁ InMây', W - base * 0.6, H * 0.045)
      octx.restore()
    }
    // chữ
    if (captions.length) {
      const ci = capIdx(t)
      drawCaption(octx, captions[ci], W, H, fx.capStyle || opt.captionStyle || 'tiktok', fx.capAnim || 'pop', t - ci * capSlot, capSlot, beat)
    }

    await vsrc.add(t, 1 / fps)
    if (f % 6 === 0) onProgress(0.05 + 0.9 * (f / nFrames))
  }

  vsrc.close()
  if (asrc) {
    await asrc.add(aud.buffer)
    asrc.close()
  }
  await output.finalize()
  const blob = new Blob([output.target.buffer], { type: 'video/mp4' })
  segs.forEach((s) => {
    s.el?.close?.()
    if (s.objectUrl) URL.revokeObjectURL(s.objectUrl)
  })
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  onProgress(1)
  return { blob, type: 'video/mp4', ext: 'mp4', seconds: total, width: W, height: H, warnings }
}

/**
 * Tự kiểm tra bộ máy: biên dịch và vẽ thử cả 178 chuyển cảnh + từng hiệu ứng, báo cái nào lỗi hoặc ra màn đen.
 */
export async function selfTest(onProgress = () => {}) {
  const W = 144
  const H = 256
  const G = makeGL(W, H)
  const gl = G.gl
  const mk = (c1, c2) => {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const x = c.getContext('2d')
    const g = x.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, c1)
    g.addColorStop(1, c2)
    x.fillStyle = g
    x.fillRect(0, 0, W, H)
    x.fillStyle = '#fff'
    x.beginPath()
    x.arc(W / 2, H / 2, 36, 0, 7)
    x.fill()
    return c
  }
  G.upload(G.texFrom, mk('#e11d48', '#fb923c'))
  G.upload(G.texTo, mk('#0ea5e9', '#6366f1'))
  const glt = (await loadGlt()).default
  const px = new Uint8Array(W * H * 4)
  const mean = () => {
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
    let s = 0
    let mn = 255
    let mx = 0
    for (let i = 0; i < px.length; i += 4) {
      const v = (px[i] + px[i + 1] + px[i + 2]) / 3
      s += v
      mn = Math.min(mn, v)
      mx = Math.max(mx, v)
    }
    return { avg: s / (px.length / 4), range: mx - mn }
  }
  const bad = []
  let ok = 0
  for (let i = 0; i < glt.length; i++) {
    const t = glt[i]
    try {
      const p = G.program(transFrag(t.glsl))
      gl.bindFramebuffer(gl.FRAMEBUFFER, G.fbo)
      gl.useProgram(p)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, G.texFrom)
      gl.uniform1i(gl.getUniformLocation(p, 'from'), 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, G.texTo)
      gl.uniform1i(gl.getUniformLocation(p, 'to'), 1)
      gl.uniform1f(gl.getUniformLocation(p, 'ratio'), W / H)
      for (const [n, ty] of Object.entries(t.paramsTypes || {})) setParam(gl, p, n, ty, (t.defaultParams || {})[n])
      let good = true
      for (const pr of [0.25, 0.5, 0.75]) {
        gl.uniform1f(gl.getUniformLocation(p, 'progress'), pr)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
        const m = mean()
        if (!(m.avg > 8)) good = false
      }
      if (good) ok++
      else bad.push(t.name + ' (ra màn đen)')
      gl.deleteProgram(p)
    } catch (e) {
      bad.push(t.name + ' (lỗi shader)')
    }
    if (i % 10 === 0) {
      onProgress(i / glt.length)
      await new Promise((r) => setTimeout(r, 0))
    }
  }
  // hiệu ứng: từng cờ một
  const fxProg = G.program(FX_FRAG)
  const names = ['pulse', 'shake', 'rgb', 'glitch', 'vignette', 'grain', 'vhs']
  const effBad = []
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.useProgram(fxProg)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, G.texFrom)
  gl.uniform1i(gl.getUniformLocation(fxProg, 'tex'), 0)
  gl.uniform2f(gl.getUniformLocation(fxProg, 'res'), W, H)
  const U = (n, v) => gl.uniform1f(gl.getUniformLocation(fxProg, n), v)
  const run = (label, set) => {
    for (const n of [...names, 'flash', 'grade', 'beat', 'time']) U(n, 0)
    U('time', 1.234)
    U('beat', 1)
    set()
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    const m = mean()
    if (!(m.avg > 8) || gl.getError() !== gl.NO_ERROR) effBad.push(label)
  }
  for (const n of names) run(n, () => U(n, 1))
  for (let g = 1; g <= 6; g++) run('màu ' + g, () => U('grade', g))
  run('flash', () => U('flash', 0.5))
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  onProgress(1)
  return { total: glt.length, ok, bad, effBad }
}
