import { useRef, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * 영역 지정 전용 큰 화면.
 *
 * 오른쪽 작은 프리뷰(352px)에서는 퀵슬롯 아이콘이 몇 픽셀밖에 안 돼서 집을 수가 없다.
 * 지정할 때만 화면을 거의 꽉 채워 띄우고, 커서 주변을 확대한 돋보기를 같이 보여준다.
 */

const LOUPE_SIZE = 148   // 돋보기 표시 크기(px)
const LOUPE_SRC = 46     // 원본에서 잘라올 크기(px) — 148/46 ≈ 3.2배

export default function RegionPickerModal({ stream, region, onConfirm, onClose }) {
  const boxRef = useRef(null)
  const videoRef = useRef(null)
  const loupeRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [ratio, setRatio] = useState('16 / 9')

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play?.().catch(() => {})
    const sync = () => {
      if (video.videoWidth) setRatio(`${video.videoWidth} / ${video.videoHeight}`)
    }
    sync()
    video.addEventListener('loadedmetadata', sync)
    return () => video.removeEventListener('loadedmetadata', sync)
  }, [stream])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toLocal = (e) => {
    const rect = boxRef.current.getBoundingClientRect()
    return {
      x: Math.min(Math.max(e.clientX - rect.left, 0), rect.width) / rect.width,
      y: Math.min(Math.max(e.clientY - rect.top, 0), rect.height) / rect.height,
    }
  }

  /** 커서 주변을 확대해서 돋보기 캔버스에 그린다 */
  const drawLoupe = useCallback((nx, ny) => {
    const video = videoRef.current
    const canvas = loupeRef.current
    if (!video || !canvas || !video.videoWidth) return
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingEnabled = false // 픽셀이 뭉개지면 아이콘 경계를 못 본다
    const sx = nx * video.videoWidth - LOUPE_SRC / 2
    const sy = ny * video.videoHeight - LOUPE_SRC / 2
    ctx.fillStyle = '#0a1016'
    ctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE)
    try {
      ctx.drawImage(video, sx, sy, LOUPE_SRC, LOUPE_SRC, 0, 0, LOUPE_SIZE, LOUPE_SIZE)
    } catch {
      // 프레임 준비 전
    }
  }, [])

  const handleMove = (e) => {
    const p = toLocal(e)
    setCursor(p)
    drawLoupe(p.x, p.y)
    if (drag) setDrag((d) => ({ ...d, x: p.x, y: p.y }))
  }

  const handleDown = (e) => {
    e.preventDefault()
    const p = toLocal(e)
    setDrag({ ox: p.x, oy: p.y, x: p.x, y: p.y })
  }

  const handleUp = () => {
    if (!drag) return
    const next = {
      x: Math.min(drag.ox, drag.x),
      y: Math.min(drag.oy, drag.y),
      w: Math.abs(drag.x - drag.ox),
      h: Math.abs(drag.y - drag.oy),
    }
    setDrag(null)
    if (next.w < 0.002 || next.h < 0.002) return // 그냥 클릭한 것
    onConfirm(next)
  }

  const shown = drag
    ? { x: Math.min(drag.ox, drag.x), y: Math.min(drag.oy, drag.y), w: Math.abs(drag.x - drag.ox), h: Math.abs(drag.y - drag.oy) }
    : region

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-6"
      style={{ background: 'rgba(4,8,14,.86)' }}
    >
      <div className="flex items-center gap-3 text-white">
        <span className="text-[15px] font-extrabold" style={{ color: 'var(--mpl-title-yellow)' }}>
          퀵슬롯의 야누스 아이콘을 드래그해서 감싸주세요
        </span>
        <span className="text-[13px]" style={{ color: '#9db0c2' }}>
          아이콘 하나만 딱 맞게 — 옆 칸이 들어가면 감지가 둔해집니다
        </span>
      </div>

      <div className="relative" style={{ maxWidth: '92vw', maxHeight: '78vh' }}>
        <div
          ref={boxRef}
          className="relative overflow-hidden rounded-lg cursor-crosshair select-none"
          style={{ aspectRatio: ratio, maxHeight: '78vh', background: '#0a1016', border: '1px solid #3a4d61' }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={() => { setCursor(null); handleUp() }}
        >
          <video ref={videoRef} muted playsInline className="w-full h-full object-fill" />

          {shown && (
            <div
              className="absolute pointer-events-none rounded-[3px]"
              style={{
                left: `${shown.x * 100}%`,
                top: `${shown.y * 100}%`,
                width: `${shown.w * 100}%`,
                height: `${shown.h * 100}%`,
                border: '2px solid var(--mpl-title-yellow)',
                boxShadow: '0 0 0 9999px rgba(4,8,14,.45)',
              }}
            />
          )}

          {/* 십자선 — 작은 아이콘을 겨냥할 때 위치를 잡아준다 */}
          {cursor && !drag && (
            <>
              <div className="absolute pointer-events-none" style={{ left: 0, right: 0, top: `${cursor.y * 100}%`, height: 1, background: 'rgba(255,228,55,.5)' }} />
              <div className="absolute pointer-events-none" style={{ top: 0, bottom: 0, left: `${cursor.x * 100}%`, width: 1, background: 'rgba(255,228,55,.5)' }} />
            </>
          )}
        </div>

        {/* 돋보기 — 퀵슬롯이 있는 우하단을 가리지 않도록 상자 안쪽 우상단에 고정 */}
        <div
          className="absolute right-3 top-3 rounded-lg overflow-hidden pointer-events-none"
          style={{ border: '2px solid var(--mpl-title-yellow)', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}
        >
          <canvas ref={loupeRef} width={LOUPE_SIZE} height={LOUPE_SIZE} style={{ display: 'block' }} />
          <div
            className="absolute inset-0"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.15)' }}
          />
          {/* 가운데 표시 — 커서가 정확히 어디를 가리키는지 */}
          <div className="absolute left-1/2 top-1/2 pointer-events-none" style={{ width: 11, height: 11, marginLeft: -6, marginTop: -6, border: '1px solid rgba(255,228,55,.9)' }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white"
          style={{ background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))' }}
        >
          취소 (Esc)
        </button>
        <span className="text-[12.5px]" style={{ color: '#8b99a8' }}>
          드래그하면 바로 적용됩니다
        </span>
      </div>
    </div>,
    document.body
  )
}
