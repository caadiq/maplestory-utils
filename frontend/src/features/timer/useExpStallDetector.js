import { useEffect, useRef } from 'react'
import { EXP_STALL, stallBand, whiteProfile, profileStrength, initialStall, stepStall } from './expStallCore'

/**
 * 화면 맨 아래 경험치 숫자를 지켜보다가, 일정 시간 동안 값이 안 오르면 알린다.
 * (동작 반복 방지에 걸려 스킬이 안 나가는 상태를 잡기 위한 것 — expStallCore 참고)
 *
 * 소리는 예약하지 않고 그 순간에 바로 울린다. 부스터와 달리 "언제 끝날지"를
 * 미리 알 수 있는 값이 아니라, 지나고 나서야 알 수 있는 상태이기 때문이다.
 *
 * 판정은 전부 expStallCore.stepStall 이 한다 — 여기서는 프레임을 떠서 넘기기만 한다.
 * 그래야 "가렸다 치우면 다시 울린다" 같은 시나리오를 DOM 없이 테스트로 고정할 수 있다.
 */
export function useExpStallDetector({ stream, enabled, videoRef, stallSec, repeat, repeatSec, onAlert, onStatus }) {
  const cbRef = useRef({ onAlert, onStatus })
  useEffect(() => { cbRef.current = { onAlert, onStatus } })

  const optsRef = useRef({ stallSec, repeat, repeatSec })
  useEffect(() => { optsRef.current = { stallSec, repeat, repeatSec } }, [stallSec, repeat, repeatSec])

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
    let state = initialStall()

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
      const { stallSec: sec, repeat: rep, repeatSec: repSec } = optsRef.current
      const res = stepStall(
        state,
        { profile, strength: profileStrength(profile, box.w, box.h), now: Date.now() },
        {
          limitMs: Math.max(3, sec || 15) * 1000,
          // 반복을 켜두면 풀 때까지 다시 알린다 — 한 번 놓쳐도 결국 알게 된다
          repeatMs: rep ? Math.max(3, repSec || 20) * 1000 : 0,
        },
      )
      state = res.state
      cbRef.current.onStatus?.(res.status)
      if (res.alert) cbRef.current.onAlert?.(res.stillSec)
    }

    const timer = setInterval(scan, EXP_STALL.scanIntervalMs)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [stream, enabled, videoRef])
}
