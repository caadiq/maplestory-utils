import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * 자동 탐색 결과 화면.
 *
 * 후보가 있으면 고르게 하고, **하나도 없으면 없다고 말한다**.
 * 예전에는 못 찾으면 곧장 직접 지정 화면으로 보냈는데, 그러면 "왜 갑자기 이게 뜨지"가 된다.
 * 퀵슬롯 말고 스킬창·단축키 설정 같은 데도 같은 아이콘이 떠 있을 수 있어서
 * "어느 것이 퀵슬롯인지"는 사람이 골라야 한다.
 */
export default function CandidatePicker({ videoRef, candidates, onPick, onManual, onRetry, onClose }) {
  const empty = candidates.length === 0
  const canvasRefs = useRef([])

  useEffect(() => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    candidates.forEach((c, i) => {
      const canvas = canvasRefs.current[i]
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = false
      const sx = c.region.x * video.videoWidth
      const sy = c.region.y * video.videoHeight
      const sw = c.region.w * video.videoWidth
      const sh = c.region.h * video.videoHeight
      // 주변을 조금 넓게 잘라 어디인지 알아보기 쉽게
      const pad = Math.max(sw, sh) * 0.5
      const cropW = sw + pad * 2
      const cropH = sh + pad * 2
      try {
        ctx.drawImage(video, sx - pad, sy - pad, cropW, cropH, 0, 0, canvas.width, canvas.height)
      } catch {
        // 프레임 준비 전
      }
      // 찾은 자리를 정확히 표시 — 주변까지 잘라 보여주므로 어느 칸인지 알려줘야 한다
      const k = canvas.width / cropW
      ctx.strokeStyle = '#ffe437'
      ctx.lineWidth = 2
      ctx.strokeRect(pad * k, pad * k, sw * k, sh * k)
    })
  }, [candidates, videoRef])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-6" style={{ background: 'rgba(4,8,14,.86)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <p className="text-[15px] font-extrabold" style={{ color: 'var(--mpl-title-yellow)' }}>
            {empty
              ? '야누스 아이콘을 찾지 못했습니다'
              : `비슷한 아이콘을 ${candidates.length}곳에서 찾았습니다`}
          </p>
          <p className="text-[13px] mt-1" style={{ color: '#9db0c2' }}>
            {empty
              ? '퀵슬롯에 야누스가 없거나, 다른 창에 가려져 있을 수 있습니다'
              : '퀵슬롯에 있는 것을 골라주세요 — 스킬창에도 같은 아이콘이 떠 있을 수 있습니다'}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {candidates.map((c, i) => (
            <button
              key={`${c.region.x}-${c.region.y}`}
              type="button"
              onClick={() => onPick(c.region)}
              className="rounded-xl overflow-hidden p-2 flex flex-col items-center gap-1.5"
              style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.18)' }}
            >
              <canvas
                ref={(el) => { canvasRefs.current[i] = el }}
                width={120}
                height={120}
                className="rounded-lg"
                style={{ background: '#0a1016' }}
              />
              <span className="text-[12px] font-bold" style={{ color: '#cfdae4' }}>
                일치도 {Math.round(c.score * 100)}%
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {empty && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white"
              style={{ background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))' }}
            >
              다시 찾기
            </button>
          )}
          <button
            type="button"
            onClick={onManual}
            className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white"
            style={{
              background: empty
                ? 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))'
                : 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
            }}
          >
            직접 지정할게요
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-[13px] font-extrabold text-white"
            style={{ background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))' }}
          >
            취소 (Esc)
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
