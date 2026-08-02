import { useEffect, useState } from 'react'

/**
 * 공유 화면 미리보기 (읽기 전용).
 * 영역 지정은 여기서 하지 않는다 — 이 크기로는 퀵슬롯 아이콘이 몇 픽셀밖에 안 돼서
 * 집을 수가 없어서 RegionPickerModal(큰 화면 + 돋보기)로 뺐다.
 */
export default function RegionPicker({ videoRef, stream, region }) {
  const [ratio, setRatio] = useState('16 / 9')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (stream && video.srcObject !== stream) {
      video.srcObject = stream
      video.play?.().catch(() => {})
    }
    // 상자 비율을 영상에 맞춰 둔다 — 여백이 생기면 표시된 영역 위치가 실제와 어긋난다
    const sync = () => {
      if (video.videoWidth) setRatio(`${video.videoWidth} / ${video.videoHeight}`)
    }
    sync()
    video.addEventListener('loadedmetadata', sync)
    video.addEventListener('resize', sync)
    return () => {
      video.removeEventListener('loadedmetadata', sync)
      video.removeEventListener('resize', sync)
    }
  }, [stream, videoRef])

  return (
    <div
      className="relative rounded-[10px] overflow-hidden"
      style={{ background: '#0a1016', border: '1px solid var(--mpl-card-line)', aspectRatio: ratio }}
    >
      <video ref={videoRef} muted playsInline className="w-full h-full object-fill" />

      {region && (
        <div
          className="absolute pointer-events-none rounded-[4px]"
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

      {!stream && (
        <div className="absolute inset-0 grid place-items-center text-[13px]" style={{ color: '#64788c' }}>
          화면 공유를 시작하면 여기에 표시됩니다
        </div>
      )}
    </div>
  )
}
