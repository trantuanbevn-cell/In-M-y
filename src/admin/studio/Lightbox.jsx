import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const Ctx = createContext(() => {})
// Mở khung xem lớn: useZoom()(items, index) với items = [{kind:'image'|'video', url, caption}]
export const useZoom = () => useContext(Ctx)

export function ZoomProvider({ children }) {
  const [st, setSt] = useState(null)
  const open = useCallback((items, index = 0) => items?.length && setSt({ items, index }), [])
  const close = () => setSt(null)
  const go = (d) => setSt((s) => s && { ...s, index: (s.index + d + s.items.length) % s.items.length })

  useEffect(() => {
    if (!st) return
    const k = (e) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [st])

  const cur = st?.items[st.index]
  return (
    <Ctx.Provider value={open}>
      {children}
      {cur && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={close}>
          <button className="lb-x" onClick={close} aria-label="Đóng">✕</button>
          {st.items.length > 1 && <button className="lb-n prev" onClick={(e) => { e.stopPropagation(); go(-1) }} aria-label="Trước">‹</button>}
          <div className="lb-body" onClick={(e) => e.stopPropagation()}>
            {cur.kind === 'video' ? <video key={cur.url} src={cur.url} controls autoPlay /> : <img key={cur.url} src={cur.url} alt="" />}
            <div className="lb-cap">{cur.caption || ''} {st.items.length > 1 ? `(${st.index + 1}/${st.items.length})` : ''}</div>
          </div>
          {st.items.length > 1 && <button className="lb-n next" onClick={(e) => { e.stopPropagation(); go(1) }} aria-label="Sau">›</button>}
        </div>
      )}
    </Ctx.Provider>
  )
}
