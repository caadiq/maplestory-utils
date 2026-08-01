import { useRef, useState, useEffect } from 'react'

/**
 * 공유 화면 미리보기 + 퀵슬롯 야누스 아이콘 영역 지정.
 * 영역은 영상 크기 대비 0~1 비율로 저장한다 — 해상도가 달라져도 같은 자리를 가리키도록.
 */
export default function RegionPicker({ videoRef, stream, region, onRegion, picking, onPickingChange }) {
  const boxRef = useRef(null)
  const [drag, setDrag] = useState(null)
  const [ratio, setRatio] = useState('16 / 9')

  useEffect(() => {
    const video = videoRef.current
    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream
      video.play?.().catch(() => {})
    }
  }, [stream, videoRef])

  /**
   * 상자 비율을 영상 비율에 맞춰 둔다.
   * 비율이 다르면 object-contain이 위아래(또는 좌우)에 검은 여백을 만드는데,
   * 그 여백까지 포함해서 좌표를 계산하면 지정한 영역이 실제 영상에서 어긋난다.
   */
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const sync = () => {
      if (video.videoWidth && video.videoHeight) {
        setRatio(`${video.videoWidth} / ${video.videoHeight}`)
      }
    }
    sync()
    video.addEventListener('loadedmetadata', sync)
    video.addEventListener('resize', sync)
    return () => {
      video.removeEventListener('loadedmetadata', sync)
      video.removeEventListener('resize', sync)
    }
  }, [stream, videoRef])

  const toLocal = (e) => {
    const rect = boxRef.current.getBoundingClientRect()
    return {
      x: Math.min(Math.max(e.clientX - rect.left, 0), rect.width) / rect.width,
      y: Math.min(Math.max(e.clientY - rect.top, 0), rect.height) / rect.height,
    }
  }

  const handleDown = (e) => {
    if (!picking) return
    e.preventDefault()
    const p = toLocal(e)
    setDrag({ ox: p.x, oy: p.y, x: p.x, y: p.y })
  }

  const handleMove = (e) => {
    if (!drag) return
    const p = toLocal(e)
    setDrag((d) => ({ ...d, x: p.x, y: p.y }))
  }

  const handleUp = () => {
    if (!drag) return
    const x = Math.min(drag.ox, drag.x)
    const y = Math.min(drag.oy, drag.y)
    const w = Math.abs(drag.x - drag.ox)
    const h = Math.abs(drag.y - drag.oy)
    setDrag(null)
    // 너무 작으면 잘못 클릭한 것으로 보고 무시 (한 픽셀만 잡히면 감지가 불안정해진다)
    if (w < 0.004 || h < 0.004) return
    onRegion({ x, y, w, h })
    onPickingChange(false)
  }

  const live = drag && {
    left: `${Math.min(drag.ox, drag.x) * 100}%`,
    top: `${Math.min(drag.oy, drag.y) * 100}%`,
    width: `${Math.abs(drag.x - drag.ox) * 100}%`,
    height: `${Math.abs(drag.y - drag.oy) * 100}%`,
  }

  return (
    <div
      ref={boxRef}
      className="relative rounded-[10px] overflow-hidden select-none"
      style={{
        background: '#0a1016',
        border: '1px solid var(--mpl-card-line)',
        aspectRatio: ratio,
        cursor: picking ? 'crosshair' : 'default',
      }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerLeave={handleUp}
    >
      <video ref={videoRef} muted playsInline className="w-full h-full object-fill" />

      {region && !drag && (
        <div
          className="absolute pointer-events-none rounded-[5px]"
          style={{
            left: `${region.x * 100}%`,
            top: `${region.y * 100}%`,
            width: `${region.w * 100}%`,
            height: `${region.h * 100}%`,
            border: '2px solid var(--mpl-title-yellow)',
            boxShadow: '0 0 0 3px rgba(255,228,55,.18), 0 0 14px rgba(255,228,55,.35)',
          }}
        />
      )}

      {live && (
        <div
          className="absolute pointer-events-none rounded-[5px]"
          style={{ ...live, border: '2px dashed var(--mpl-title-yellow)', background: 'rgba(255,228,55,.1)' }}
        />
      )}

      {picking && (
        <div
          className="absolute left-0 right-0 top-0 px-3 py-2 text-[12.5px] font-bold pointer-events-none"
          style={{ background: 'rgba(10,16,22,.82)', color: '#ffe437' }}
        >
          퀵슬롯의 야누스 아이콘을 드래그해서 감싸주세요
        </div>
      )}

      {!stream && (
        <div className="absolute inset-0 grid place-items-center text-[13px]" style={{ color: '#64788c' }}>
          화면 공유를 시작하면 여기에 표시됩니다
        </div>
      )}
    </div>
  )
}
