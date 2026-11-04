// Danh mục lựa chọn cho bộ dựng video kiểu TikTok: chuyển cảnh, hiệu ứng, màu, âm thanh, mẫu nhanh

// Chuyển cảnh chọn lọc từ thư viện GL Transitions (MIT). Giá trị là tên trong thư viện.
export const TRANSITIONS = [
  ['Fade', 'Mờ dần'], ['CrossZoom', 'Zoom mờ'], ['SimpleZoom', 'Phóng nhanh'], ['ZoomInCircles', 'Vòng tròn zoom'],
  ['Dreamy', 'Mơ màng'], ['DreamyZoom', 'Mơ màng zoom'], ['WipeLeft', 'Quét trái'], ['WipeRight', 'Quét phải'],
  ['Directional', 'Đẩy lên'], ['Swap', 'Đảo 3D'], ['Cube', 'Khối lập phương'], ['BookFlip', 'Lật sách'],
  ['InvertedPageCurl', 'Lật trang'], ['WhipPan', 'Giật máy'], ['WhipSpin', 'Xoay giật'], ['PopIn', 'Bật ra'],
  ['Bounce', 'Nảy'], ['Swirl', 'Xoáy'], ['Kaleidoscope', 'Vạn hoa'], ['Ripple', 'Gợn nước'],
  ['WaterDrop', 'Giọt nước'], ['Pixelize', 'Vỡ pixel'], ['Mosaic', 'Ghép mảnh'], ['PolkaDotsCurtain', 'Chấm bi'],
  ['HeartWipe', 'Trái tim'], ['StarWipe', 'Ngôi sao'], ['CircleOpen', 'Mở tròn'], ['WindowSlices', 'Cửa chớp'],
  ['GlitchMemories', 'Glitch'], ['GlitchDisplace', 'Glitch lệch'], ['TvStatic', 'Nhiễu TV'], ['VhsTracking', 'Băng VHS'],
  ['FilmBurn', 'Cháy phim'], ['UndulatingBurnOut', 'Cháy lan'], ['FlashFade', 'Chớp sáng'], ['LightStreaks', 'Vệt sáng'],
  ['Shatter', 'Vỡ kính'], ['Disintegrate', 'Tan biến'], ['LinearBlur', 'Mờ chuyển động'], ['TangentMotionBlur', 'Mờ xoay'],
]

export const EFFECTS = [
  ['pulse', '💓 Zoom giật theo nhịp'],
  ['shake', '📳 Rung máy'],
  ['rgb', '🌈 Tách màu RGB'],
  ['glitch', '👾 Glitch'],
  ['flash', '⚡ Chớp trắng khi chuyển'],
  ['vignette', '🕶️ Tối viền'],
  ['grain', '🎞️ Hạt phim'],
  ['vhs', '📼 Băng VHS'],
]

export const GRADES = [
  ['', 'Giữ nguyên'], ['warm', '🔥 Ấm'], ['cool', '❄️ Lạnh'], ['vivid', '🎨 Rực rỡ'],
  ['dream', '🌸 Mơ màng'], ['moody', '🌙 Trầm huyền bí'], ['bw', '⚫ Trắng đen'],
]

export const SFX = [
  ['whoosh', '💨 Vút khi chuyển cảnh'],
  ['boom', '🥁 Boom khi chuyển cảnh'],
  ['sparkle', '✨ Lấp lánh khi chuyển cảnh'],
  ['pop', '🫧 Pop khi đổi chữ'],
  ['tick', '⏱️ Tick khi đổi chữ'],
  ['intro', '🔔 Ding mở đầu'],
  ['riser', '📈 Dồn nhịp cuối video'],
  ['outro', '🎉 Ding kết'],
]

// Chuyển động cho ảnh tĩnh (clip AI thì dùng chuyển động camera ở tab AI)
export const MOTIONS = [
  ['', 'Theo bước 4'], ['zoom_in', '🔍 Zoom vào'], ['zoom_out', '🔎 Zoom ra'], ['pan', '↔️ Lia ngang'],
  ['orbit', '🔄 Xoay quanh (giả lập)'], ['tilt_up', '⬆️ Ngước lên'], ['fast_cuts', '⚡ Nhịp nhanh'], ['none', '⏸️ Đứng yên'],
]

// Chuyển động camera cho video AI (đưa vào câu lệnh)
export const CAMERA = [
  ['', 'Theo cốt truyện'],
  ['orbit', '🔄 Quay quanh vật thể', 'the camera smoothly orbits around the product in a wide arc, revealing it from the side while keeping it centered and sharp, background shifting in correct perspective'],
  ['push', '🔍 Đẩy vào', 'slow dolly-in toward the product, gentle parallax'],
  ['pull', '↔️ Kéo ra', 'slow dolly-out revealing the surroundings'],
  ['pan', '➡️ Lia ngang', 'smooth horizontal pan from left to right'],
  ['crane', '⬇️ Hạ từ trên xuống', 'crane shot descending from above down to the product'],
  ['tilt', '⬆️ Ngước lên', 'low angle, camera tilts up along the product'],
  ['hand', '🤳 Cầm tay nhẹ', 'subtle handheld camera sway, natural and alive'],
  ['zoom', '⚡ Zoom nhanh', 'fast punch-in zoom on the product detail'],
]

export const CAP_STYLES = [['tiktok', 'TikTok vàng'], ['minimal', 'Tối giản'], ['cute', 'Dễ thương'], ['neon', 'Neon']]
export const CAP_ANIMS = [['pop', 'Bật to dần'], ['slide', 'Trượt lên'], ['type', 'Gõ từng chữ'], ['beat', 'Nhún theo nhịp'], ['none', 'Đứng yên']]
export const STICKERS = [
  ['price', '🏷️ Tem giá (lấy từ thông tin sản phẩm)'],
  ['limited', '🔥 Tem “số lượng có hạn”'],
  ['cta', '💬 Dải kêu gọi ở cuối'],
  ['logo', '☁️ Logo InMây góc phải'],
]

export const DEFAULT_FX = {
  transitions: ['CrossZoom'],
  randomAll: false,
  tdur: 0.5,
  motion: '',
  effects: [],
  grade: '',
  sfx: [],
  capStyle: '',
  capAnim: 'pop',
  bpm: 110,
  keepClip: true,
  stickers: [],
  limitedText: 'Số lượng có hạn',
  ctaText: 'Nhắn InMây ngay',
}

// Mẫu nhanh: bấm một lần là tích sẵn cả bộ
export const PRESETS = [
  { id: 'beat', icon: '🔥', name: 'Giật nhịp sôi động', desc: 'Zoom giật, rung, tách màu, tiếng vút', fx: { transitions: ['CrossZoom', 'GlitchMemories', 'WhipPan'], effects: ['pulse', 'shake', 'rgb', 'flash'], grade: 'vivid', sfx: ['whoosh', 'pop', 'intro'], capStyle: 'tiktok', capAnim: 'pop', bpm: 120, tdur: 0.4 } },
  { id: 'dream', icon: '🌸', name: 'Mơ màng dễ thương', desc: 'Màu pastel, lấp lánh, chữ nhún', fx: { transitions: ['Dreamy', 'DreamyZoom', 'HeartWipe'], effects: ['vignette', 'grain'], grade: 'dream', sfx: ['sparkle', 'intro'], capStyle: 'cute', capAnim: 'beat', bpm: 90, tdur: 0.7 } },
  { id: 'product', icon: '🛍️', name: 'Giới thiệu sản phẩm', desc: 'Gọn, sạch, tem giá và nút nhắn tin', fx: { transitions: ['WipeLeft', 'SimpleZoom', 'Directional'], effects: ['vignette'], grade: 'warm', sfx: ['whoosh', 'outro'], capStyle: 'minimal', capAnim: 'slide', bpm: 100, tdur: 0.45, stickers: ['price', 'cta', 'logo'] } },
  { id: 'spooky', icon: '🎃', name: 'Ma mị / Halloween', desc: 'Tối, nhiễu, cháy lan, tiếng boom', fx: { transitions: ['UndulatingBurnOut', 'GlitchDisplace', 'FilmBurn'], effects: ['glitch', 'vignette', 'grain', 'rgb'], grade: 'moody', sfx: ['boom', 'riser', 'tick'], capStyle: 'neon', capAnim: 'type', bpm: 80, tdur: 0.6 } },
  { id: 'retro', icon: '📼', name: 'Băng VHS hoài cổ', desc: 'Nhiễu TV, hạt phim, màu ấm', fx: { transitions: ['VhsTracking', 'TvStatic', 'Pixelize'], effects: ['vhs', 'grain', 'rgb'], grade: 'warm', sfx: ['tick', 'whoosh'], capStyle: 'tiktok', capAnim: 'none', bpm: 100, tdur: 0.45 } },
  { id: 'gift', icon: '🎁', name: 'Quà tặng ấm áp', desc: 'Trái tim, ngôi sao, tem giá', fx: { transitions: ['HeartWipe', 'StarWipe', 'Fade'], effects: ['vignette', 'grain'], grade: 'warm', sfx: ['sparkle', 'outro'], capStyle: 'cute', capAnim: 'pop', bpm: 95, tdur: 0.6, stickers: ['price', 'limited', 'cta'] } },
]
