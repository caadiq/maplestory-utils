import { useEffect, useRef } from 'react'
import { EXP_STALL, stallBand, whiteProfile, profileStrength, profileDiff, shouldAlert } from './expStallCore'

/**
 * 화면 맨 아래 경험치 숫자를 지켜보다가, 일정 시간 동안 값이 안 오르면 알린다.
 * (동작 반복 방지에 걸려 스킬이 안 나가는 상태를 잡기 위한 것 — expStallCore 참고)
 *
 * 소리는 예약하지 않고 그 순간에 바로 울린다. 부스터와 달리 "언제 끝날지"를
 * 미리 알 수 있는 값이 아니라, 지나고 나서야 알 수 있는 상태이기 때문이다.
 *
 * ### 헛알림을 막는 장치
 * 한 번이라도 변한 걸 본 뒤에야 알림을 건다. 게임 창이 아니라 화면 전체를 공유해서
 * 띠가 작업표시줄을 보고 있으면 그 자리는 원래 안 변하는데, 그걸 '멈췄다'로 치면
 * 가만히 있어도 계속 울린다. 처음 한 번의 변화가 "여기가 경험치 줄이 맞다"는 확인이 된다.
 */
export function useExpStallDetector({ stream, enabled, videoRef, stallSec, onAlert, onStatus }) {
  const cbRef = useRef({ onAlert, onStatus })
  useEffect(() => { cbRef.current = { onAlert, onStatus } })

  const stallSecRef = useRef(stallSec)
  useEffect(() => { stallSecRef.current = stallSec }, [stallSec])

  useEffect(() => {
    if (!stream || !enabled) {
      cbRef.current.onStatus?.(null)
      return
    }
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let alive = true
    let prev = null
    let lastChangeAt = 0
    let lastAlertAt = 0
    let armed = false

    const scan = () => {
      if (!alive) return
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return

      const box = stallBand(vw, vh)
      if (canvas.width !== box.w || canvas.height !== box.h) {
        canvas.width = box.w
        canvas.height = box.h
      }
      let img
      try {
        ctx.drawImage(video, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h)
        img = ctx.getImageData(0, 0, box.w, box.h)
      } catch {
        return // 프레임이 아직 준비 안 됨
      }

      const profile = whiteProfile(img.data, box.w, box.h)
      const strength = profileStrength(profile, box.w, box.h)
      const now = Date.now()

      // 글자가 안 보이면 판정을 아예 쉰다 — 경험치 표시를 꺼둔 경우가 여기 걸린다
      if (strength < EXP_STALL.textFloor) {
        prev = null
        cbRef.current.onStatus?.({ reason: 'notext' })
        return
      }

      /*
       * 첫 장은 기준만 잡고 넘어간다. 비교 상대가 없을 때의 profileDiff는 1이라
       * 그대로 두면 '변했다'가 되어 첫 스캔에 바로 무장돼 버린다 —
       * 그러면 원래 안 변하는 자리(작업표시줄 등)를 봐도 알림이 울린다.
       */
      if (!prev) {
        prev = profile
        lastChangeAt = now
        cbRef.current.onStatus?.({ reason: 'waiting' })
        return
      }

      const diff = profileDiff(prev, profile)
      prev = profile

      if (diff > EXP_STALL.changeThreshold) {
        lastChangeAt = now
        lastAlertAt = 0
        armed = true
        cbRef.current.onStatus?.({ reason: 'ok', stillSec: 0 })
        return
      }
      if (!armed) {
        // 첫 변화를 아직 못 봤다 — 여기가 경험치 줄이 맞는지 확인되지 않은 상태
        cbRef.current.onStatus?.({ reason: 'waiting' })
        return
      }

      const stillMs = now - lastChangeAt
      const limitMs = Math.max(3, stallSecRef.current || 15) * 1000
      const stalled = stillMs >= limitMs
      cbRef.current.onStatus?.({ reason: stalled ? 'stall' : 'ok', stillSec: Math.floor(stillMs / 1000) })
      if (!stalled) return

      // 풀 때까지 같은 간격으로 다시 알린다 — 한 번 놓쳐도 결국 알게 된다
      if (!shouldAlert(stillMs, limitMs, lastAlertAt ? now - lastAlertAt : null)) return
      lastAlertAt = now
      cbRef.current.onAlert?.(Math.floor(stillMs / 1000))
    }

    const timer = setInterval(scan, EXP_STALL.scanIntervalMs)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [stream, enabled, videoRef])
}
