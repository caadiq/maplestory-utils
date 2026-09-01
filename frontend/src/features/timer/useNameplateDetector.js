import { useEffect, useRef, useCallback } from 'react'
import { contentBox } from './locateCore'
import { measuredUiScale } from './uiCalibration'
import {
  NAMEPLATE, toGray, calibrate, scoreProfiles, decide, searchBand,
  findExpBar, findNameSpan,
} from './nameplateCore'

/**
 * 화면 공유 중 좌하단 **닉네임 판**을 지켜보다가, 캐릭터가 바뀌면 알린다.
 *
 * 본섭·챌섭을 오갈 때마다 알림 스위치를 손으로 바꾸던 것을 없애려는 것이다.
 * 계산은 전부 nameplateCore에 있고 여기서는 프레임을 떠서 넘기고 표 계산만 한다.
 *
 * 워커를 쓰지 않는다 — 보정 80ms / 판정 0.6ms(실측)로, 이미 메인스레드에서 도는
 * 야누스 2초 스캔보다 가볍다. 게다가 3초에 한 번만 돈다.
 */

/** 보정에 실패했을 때 다시 시도하는 간격 — 캐릭터 선택 화면 등에서 계속 두드리지 않게 */
const RECALIBRATE_MS = 8000
/** 판정이 이만큼 연속으로 통과선을 못 넘으면 자리를 다시 잡는다 (창 크기·해상도 변경) */
const LOST_BEFORE_RECALIB = 2

export function useNameplateDetector({ videoRef, stream, enabled, profiles, onProfile, onStatus }) {
  const cbRef = useRef({ onProfile, onStatus })
  useEffect(() => { cbRef.current = { onProfile, onStatus } })

  const profilesRef = useRef(profiles)
  useEffect(() => { profilesRef.current = profiles }, [profiles])

  const busyRef = useRef(false)
  /** 잡아둔 자리 (띠 안 좌표). 보정에 성공해야 생긴다 */
  const spotRef = useRef(null)
  const nextCalibRef = useRef(0)
  const lostRef = useRef(0)
  /** 연속 투표 — 같은 프로필이 NAMEPLATE.votes 번 나와야 전환한다 */
  const voteRef = useRef({ id: null, n: 0 })
  const currentRef = useRef(null)

  /**
   * 지금 프레임에서 하단 띠를 떠 온다.
   * 게임 화면 **바닥**만 쓴다 — 왼쪽 끝은 못 믿는 값이라 calibrate가 가로 전체를 훑는다.
   */
  const grabBand = useCallback(() => {
    const video = videoRef.current
    const vw = video?.videoWidth
    const vh = video?.videoHeight
    if (!vw || !vh) return null
    const canvas = document.createElement('canvas')
    canvas.width = vw
    canvas.height = vh
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let full
    try {
      ctx.drawImage(video, 0, 0, vw, vh)
      full = ctx.getImageData(0, 0, vw, vh).data
    } catch {
      return null   // 프레임이 아직 안 왔다
    }
    /*
     * 게임 화면 바닥은 경험치 바에서 얻는다 — contentBox는 확장 UI에서
     * 옆에 뜬 창까지 화면으로 쳐서 어긋난다. 못 찾으면 contentBox로 물러선다.
     */
    const bar = findExpBar(full, vw, vh)
    let bottom
    let s
    if (bar) {
      s = (bar.top + 10) / 768
      bottom = bar.top + Math.round(10.1 * s)
    } else {
      try {
        bottom = contentBox(full, vw, vh).bottom
      } catch {
        bottom = vh
      }
      s = measuredUiScale(vw, vh) ?? Math.max(1, bottom / 768)
    }
    const box = searchBand(vw, vh, bottom, s)
    let rgba
    try {
      rgba = ctx.getImageData(box.x, box.y, box.w, box.h).data
    } catch {
      return null
    }
    return { gray: toGray(rgba), rgba, w: box.w, h: box.h, box, s, vw, vh, bottom }
  }, [videoRef])

  /**
   * 지금 화면의 닉네임으로 새 프로필 재료를 만든다 (등록 버튼이 부른다).
   *
   * 잉크 폭은 **여기서만** 잰다 — 글자색 마스크는 보스전 이펙트 위에서 38~41% 깨진다.
   * 등록은 조용한 화면에서 한 번 하는 일이라 그때만 쓰면 안전하다.
   */
  const capture = useCallback(() => {
    const video = videoRef.current
    const vw = video?.videoWidth
    const vh = video?.videoHeight
    if (!vw || !vh) return null
    const canvas = document.createElement('canvas')
    canvas.width = vw
    canvas.height = vh
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    let full
    try {
      ctx.drawImage(video, 0, 0, vw, vh)
      full = ctx.getImageData(0, 0, vw, vh).data
    } catch {
      return null
    }

    /*
     * 게임 화면 왼쪽 끝은 **경험치 바**로 잡는다.
     * 캡처 왼쪽에 붙어 있다고 가정하면 확장 UI에서 검은 여백을 자른다
     * (실사용 보고: 조각이 몇 px짜리로 잘렸다). contentBox의 left도 못 쓴다 —
     * 게임 왼쪽에 뜬 UI 창을 화면 시작으로 잡는다(nameplateCore 주석 참고).
     */
    const bar = findExpBar(full, vw, vh)
    if (!bar) return null
    const span = findNameSpan(full, vw, vh, bar.left, bar.top)
    if (!span) return null

    const s = (bar.top + 10) / 768
    const patch = new Float32Array(span.w * span.h)
    const thumbData = new Uint8ClampedArray(span.w * span.h * 4)
    for (let j2 = 0; j2 < span.h; j2++) {
      const src = ((span.y + j2) * vw + span.x) * 4
      thumbData.set(full.subarray(src, src + span.w * 4), j2 * span.w * 4)
      for (let i2 = 0; i2 < span.w; i2++) {
        const p = src + i2 * 4
        patch[j2 * span.w + i2] = 0.299 * full[p] + 0.587 * full[p + 1] + 0.114 * full[p + 2]
      }
    }
    return {
      patch: Array.from(patch),   // JSON으로 저장하므로 일반 배열로
      pw: span.w,
      ph: span.h,
      scale: s,
      // 화면에 보여줄 조각 (사용자가 제대로 잘렸는지 눈으로 확인한다)
      thumb: thumbOf(thumbData, span.w, span.h),
    }
  }, [videoRef])

  /* ── 감지 루프 ─────────────────────────────────────────── */

  useEffect(() => {
    if (!stream || !enabled) {
      spotRef.current = null
      voteRef.current = { id: null, n: 0 }
      return undefined
    }
    let alive = true

    const tick = async () => {
      if (!alive || busyRef.current) return
      const list = profilesRef.current || []
      if (list.length < 2) return   // 하나뿐이면 전환할 데가 없다
      busyRef.current = true
      try {
        const band = grabBand()
        if (!band) return
        const { gray, w, h, s } = band

        // 자리를 모르면 먼저 찾는다
        if (!spotRef.current) {
          if (Date.now() < nextCalibRef.current) return
          const found = calibrate(gray, w, h, list, s)
          if (!found) {
            nextCalibRef.current = Date.now() + RECALIBRATE_MS
            cbRef.current.onStatus?.('닉네임 판을 못 찾음')
            return
          }
          spotRef.current = found
          lostRef.current = 0
        }

        const scored = scoreProfiles(gray, w, h, list, spotRef.current, s)
        const top = scored[0]
        if (!top || top.score < NAMEPLATE.absent) {
          // 판이 사라졌다(캐릭터 선택·상점 등) — 지금 프로필을 유지한다
          if (++lostRef.current >= LOST_BEFORE_RECALIB) {
            spotRef.current = null
            nextCalibRef.current = Date.now() + RECALIBRATE_MS
          }
          voteRef.current = { id: null, n: 0 }
          return
        }
        lostRef.current = 0

        const res = decide(scored)
        if (!res) { voteRef.current = { id: null, n: 0 }; return }

        const vote = voteRef.current
        voteRef.current = vote.id === res.id ? { id: res.id, n: vote.n + 1 } : { id: res.id, n: 1 }
        if (voteRef.current.n < NAMEPLATE.votes) return
        if (currentRef.current === res.id) return

        currentRef.current = res.id
        cbRef.current.onProfile?.(res.id, res.score)
      } finally {
        busyRef.current = false
      }
    }

    const timer = setInterval(tick, NAMEPLATE.scanMs)
    tick()
    return () => { alive = false; clearInterval(timer) }
  }, [stream, enabled, grabBand])

  /** 밖에서 "지금 이 프로필이다"라고 알려줄 때 (수동 선택·저장 직후) */
  const setCurrent = useCallback((id) => {
    currentRef.current = id
    voteRef.current = { id, n: 0 }
  }, [])

  return { capture, setCurrent }
}

/** 잘라낸 조각을 화면에 띄울 data URL로 (사용자가 눈으로 확인하는 용도) */
function thumbOf(rgba, w, h) {
  try {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d')
    const img = ctx.createImageData(w, h)
    img.data.set(rgba)
    ctx.putImageData(img, 0, 0)
    return c.toDataURL('image/png')
  } catch {
    return null
  }
}
