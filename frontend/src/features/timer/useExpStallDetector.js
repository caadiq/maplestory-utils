import { useEffect, useRef } from 'react'
import { EXP_STALL, stallBand, whiteProfile, profileStrength, initialStall, stepStall } from './expStallCore'
import { findExpBar } from './nameplateCore'
import { contentBox } from './locateCore'

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
    // 게임 창을 통째로 뜨는 캔버스 — 경험치 바를 찾을 때만 쓴다
    const full = document.createElement('canvas')
    const fctx = full.getContext('2d', { willReadFrequently: true })
    let alive = true
    let state = initialStall()
    /** 게임 창 위치. 한 번 찾으면 붙잡고, 글자가 안 보이면 다시 찾는다 */
    let game = null
    let missed = 0

    /*
     * 경험치 줄은 캡처 바닥이 아니라 **게임 창 바닥**에 있다.
     * 확장 해상도에서는 게임 아래가 검은 여백이라 둘이 178px 어긋난다 — 그대로 두면
     * 띠가 여백만 보고 동꼽 알림이 아예 안 돈다(실측). 그래서 게임 창을 찾아 맞춘다.
     */
    const locate = () => {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return null
      full.width = vw
      full.height = vh
      let d
      try {
        fctx.drawImage(video, 0, 0, vw, vh)
        d = fctx.getImageData(0, 0, vw, vh).data
      } catch { return null }
      const bar = findExpBar(d, vw, vh)
      if (!bar) return null
      let right = vw
      try { right = contentBox(d, vw, vh).right } catch { /* 못 찾으면 캡처 끝 */ }
      return { left: bar.left, right, top: bar.top }
    }

    const scan = () => {
      if (!alive) return
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return

      if (!game) game = locate()
      const box = stallBand(vw, vh, game)
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
      /*
       * 글자가 계속 안 보이면 게임 창을 다시 찾는다 — 창을 옮겼거나 해상도를 바꿨을 때다.
       * 잠깐 가려진 것과 헷갈리지 않게 몇 번 연속으로 안 보일 때만 움직인다.
       */
      if (strength < EXP_STALL.textFloor) {
        if (++missed >= 5) { game = null; missed = 0 }
      } else missed = 0

      const { stallSec: sec, repeat: rep, repeatSec: repSec } = optsRef.current
      const res = stepStall(
        state,
        { profile, strength, now: Date.now() },
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
