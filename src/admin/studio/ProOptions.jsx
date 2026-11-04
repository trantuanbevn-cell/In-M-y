import { useState } from 'react'
import { CAP_ANIMS, CAP_STYLES, DEFAULT_FX, EFFECTS, GRADES, MOTIONS, PRESETS, SFX, STICKERS, TRANSITIONS } from './proCatalog.js'
import { selfTest } from './proRender.js'

const has = (arr, v) => (arr || []).includes(v)
const flip = (arr, v) => (has(arr, v) ? arr.filter((x) => x !== v) : [...(arr || []), v])

const Chip = ({ on, onClick, children, title }) => (
  <button type="button" title={title} className={'chip' + (on ? ' on' : '')} onClick={onClick}>
    {children}
  </button>
)

// Các nhóm tuỳ chọn kiểu TikTok, chia tab nhỏ để không phải cuộn dài. exportNode là tab cuối (Dựng).
export default function ProOptions({ fx, setFx, exportNode, count }) {
  const [tab, setTab] = useState('preset')
  const [test, setTest] = useState(null)
  const [testing, setTesting] = useState(false)
  const runTest = async () => {
    setTesting(true)
    setTest(null)
    try {
      setTest(await selfTest())
    } catch (e) {
      setTest({ fail: e.message || String(e) })
    }
    setTesting(false)
  }
  const set = (patch) => setFx((f) => ({ ...f, ...patch }))
  const tabs = [
    ['preset', '⚡ Mẫu nhanh'],
    ['trans', '🔀 Chuyển cảnh', fx.randomAll ? 'ngẫu nhiên' : fx.transitions.length],
    ['fx', '✨ Hiệu ứng', fx.effects.length + (fx.grade ? 1 : 0)],
    ['text', '🔤 Chữ và tem', fx.stickers.length],
    ['sound', '🔊 Âm thanh', fx.sfx.length],
    ['out', '🎬 Dựng'],
  ]
  return (
    <div className="pro">
      <div className="tabs">
        {tabs.map(([id, label, n]) => (
          <button key={id} type="button" className={'tabbtn' + (tab === id ? ' on' : '')} onClick={() => setTab(id)}>
            {label}
            {n ? <span className="cnt">{n}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'preset' && (
        <div>
          <p className="muted small">Bấm một mẫu để tích sẵn cả bộ chuyển cảnh, hiệu ứng, màu và âm thanh. Sau đó bạn vẫn chỉnh được từng thứ ở các tab bên cạnh.</p>
          <div className="presets">
            {PRESETS.map((p) => (
              <button key={p.id} type="button" className="preset" onClick={() => { setFx({ ...DEFAULT_FX, ...p.fx }); setTab('out') }}>
                <span className="pi">{p.icon}</span>
                <b>{p.name}</b>
                <span className="small muted">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'trans' && (
        <div>
          <p className="muted small">Chọn một hoặc nhiều kiểu. Các chỗ nối giữa các ảnh/clip sẽ dùng lần lượt các kiểu đã tích. Thư viện GL Transitions có 178 kiểu, đây là 40 kiểu đẹp nhất.</p>
          <div className="chips">
            <Chip on={fx.randomAll} onClick={() => set({ randomAll: !fx.randomAll })}>🎲 Ngẫu nhiên trong 173 kiểu</Chip>
          </div>
          {!fx.randomAll && (
            <div className="chips" style={{ marginTop: 8 }}>
              {TRANSITIONS.map(([id, label]) => (
                <Chip key={id} on={has(fx.transitions, id)} onClick={() => set({ transitions: flip(fx.transitions, id) })}>{label}</Chip>
              ))}
            </div>
          )}
          <label style={{ marginTop: 10 }}>
            Thời gian mỗi lần chuyển: {fx.tdur.toFixed(2)} giây
            <input type="range" min="0.2" max="1.2" step="0.05" value={fx.tdur} onChange={(e) => set({ tdur: Number(e.target.value) })} />
          </label>
          {!fx.randomAll && fx.transitions.length === 0 && <p className="small">Chưa tích kiểu nào: các cảnh sẽ nối thẳng, không chuyển.</p>}
        </div>
      )}

      {tab === 'fx' && (
        <div>
          <div className="lbl">Chuyển động của ảnh tĩnh (chọn một)</div>
          <div className="chips">
            {MOTIONS.map(([id, label]) => (
              <Chip key={id || 'auto'} on={fx.motion === id} onClick={() => set({ motion: id })}>{label}</Chip>
            ))}
          </div>
          <p className="muted small">Ảnh tĩnh không quay quanh vật thể thật được, “Xoay quanh” chỉ là giả lập nhẹ. Muốn quay quanh thật, dùng tab “AI tạo video” và chọn chuyển động camera “Quay quanh vật thể”.</p>
          <div className="lbl" style={{ marginTop: 12 }}>Hiệu ứng hình (chọn nhiều)</div>
          <div className="chips">
            {EFFECTS.map(([id, label]) => (
              <Chip key={id} on={has(fx.effects, id)} onClick={() => set({ effects: flip(fx.effects, id) })}>{label}</Chip>
            ))}
          </div>
          <div className="lbl" style={{ marginTop: 12 }}>Tông màu (chọn một)</div>
          <div className="chips">
            {GRADES.map(([id, label]) => (
              <Chip key={id || 'none'} on={fx.grade === id} onClick={() => set({ grade: id })}>{label}</Chip>
            ))}
          </div>
          <label style={{ marginTop: 12 }}>
            Nhịp của hiệu ứng giật/rung: {fx.bpm} nhịp mỗi phút
            <input type="range" min="60" max="150" step="5" value={fx.bpm} onChange={(e) => set({ bpm: Number(e.target.value) })} />
          </label>
          <p className="muted small">Chỉnh nhịp cho khớp với bài nhạc của bạn (hầu hết nhạc TikTok khoảng 100–130).</p>
          <div className="row" style={{ marginTop: 10 }}>
            <button type="button" className="btn ghost" disabled={testing} onClick={runTest}>{testing ? 'Đang kiểm tra…' : '🧪 Kiểm tra toàn bộ chuyển cảnh và hiệu ứng'}</button>
          </div>
          {test?.fail && <p className="error">{test.fail}</p>}
          {test && !test.fail && (
            <p className="small">
              Chuyển cảnh: <b>{test.ok}/{test.total}</b> chạy tốt.{test.bad.length ? ' Lỗi: ' + test.bad.join(', ') + '.' : ''} Hiệu ứng/màu: {test.effBad.length ? 'lỗi ở ' + test.effBad.join(', ') : <b>tất cả chạy tốt</b>}.
            </p>
          )}
        </div>
      )}

      {tab === 'text' && (
        <div>
          <div className="lbl">Kiểu chữ phụ đề</div>
          <div className="chips">
            <Chip on={!fx.capStyle} onClick={() => set({ capStyle: '' })}>Theo bước 4</Chip>
            {CAP_STYLES.map(([id, label]) => <Chip key={id} on={fx.capStyle === id} onClick={() => set({ capStyle: id })}>{label}</Chip>)}
          </div>
          <div className="lbl" style={{ marginTop: 12 }}>Chữ xuất hiện thế nào</div>
          <div className="chips">
            {CAP_ANIMS.map(([id, label]) => <Chip key={id} on={fx.capAnim === id} onClick={() => set({ capAnim: id })}>{label}</Chip>)}
          </div>
          <div className="lbl" style={{ marginTop: 12 }}>Tem dán (chọn nhiều)</div>
          <div className="chips">
            {STICKERS.map(([id, label]) => <Chip key={id} on={has(fx.stickers, id)} onClick={() => set({ stickers: flip(fx.stickers, id) })}>{label}</Chip>)}
          </div>
          {has(fx.stickers, 'limited') && (
            <label style={{ marginTop: 8 }}>Chữ trên tem “có hạn”<input value={fx.limitedText} onChange={(e) => set({ limitedText: e.target.value })} /></label>
          )}
          {has(fx.stickers, 'cta') && (
            <label style={{ marginTop: 8 }}>Chữ trên dải kêu gọi<input value={fx.ctaText} onChange={(e) => set({ ctaText: e.target.value })} /></label>
          )}
          <p className="muted small">Chỉ tích tem “có hạn” khi đúng sự thật, tránh bị sàn nhắc vì quảng cáo sai.</p>
        </div>
      )}

      {tab === 'sound' && (
        <div>
          <p className="muted small">Tiếng hiệu ứng do app tự tạo ra nên không dính bản quyền. Nhạc nền chọn ở tab Dựng.</p>
          <div className="chips">
            {SFX.map(([id, label]) => <Chip key={id} on={has(fx.sfx, id)} onClick={() => set({ sfx: flip(fx.sfx, id) })}>{label}</Chip>)}
          </div>
          <label className="check" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={fx.keepClip} onChange={(e) => set({ keepClip: e.target.checked })} /> Giữ tiếng của clip AI (nếu có clip video trong danh sách chọn)
          </label>
        </div>
      )}

      {tab === 'out' && exportNode}
    </div>
  )
}
