/**
 * 공유 화면에서 **게임 화면이 실제로 차지하는 자리**를 재는 것들.
 *
 * 창 크기를 바꾸면 캡처 크기는 바로 커지는데 게임은 한 박자 늦게 따라온다.
 * 그 사이에 재면 게임 화면을 실제보다 작게 잡아 지정 영역이 그만큼 밀린다 —
 * 여기 있는 것들은 전부 "언제 재야 믿을 수 있는가"를 다룬다.
 */
import { contentBox } from './locateCore'

/**
 * 지금 프레임의 캡처 크기와 **게임 화면 우하단**을 잰다.
 * 창 크기가 바뀌었을 때 지정 영역을 어디로 옮길지의 기준이 된다.
 */
export function measureFrame(video) {
  const w = video.videoWidth
  const h = video.videoHeight
  if (!w || !h) return null
  try {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const ctx = c.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(video, 0, 0, w, h)
    const { right, bottom } = contentBox(ctx.getImageData(0, 0, w, h).data, w, h)
    return { w, h, right, bottom }
  } catch {
    /*
     * 프레임을 못 읽었다 — 게임 화면 모서리는 **모르는 채로** 둔다.
     * 캡처 전체를 게임 화면이라고 넘겨 버리면, 여백이 생긴 경우에 상자를
     * 그 여백 속으로 밀어 넣는다(shiftRegion 참고).
     */
    return { w, h }
  }
}

/**
 * 새 프레임이 화면에 올라올 때까지 기다린다.
 *
 * 창 크기 변경 이벤트가 온 순간에는 videoWidth만 새 값이고 그려지는 그림은 아직
 * 이전 프레임일 수 있다. 그 프레임을 재면 새로 생긴 여백을 못 본다.
 */
export function nextFrame(video, capMs = 500) {
  return new Promise((resolve) => {
    if (typeof video.requestVideoFrameCallback === 'function') {
      let done = false
      const fin = () => { if (!done) { done = true; resolve() } }
      video.requestVideoFrameCallback(fin)
      setTimeout(fin, capMs) // 프레임이 안 와도 영영 기다리지 않는다
      return
    }
    setTimeout(resolve, Math.min(200, capMs))
  })
}

/**
 * 화면이 잠잠해질 때까지 기다렸다가 잰다.
 *
 * 창 크기가 멈춰도 게임은 바로 따라오지 않는다. 실측(창 크기 변경 브라우저 캡처.mp4):
 * 창이 28.0초에 멈췄는데 게임이 오른쪽 여백을 다 채운 건 30.0초 — **2초가 걸렸다.**
 * 그 사이에 재면 게임 화면이 실제보다 좁게 잡혀 영역이 그만큼 밀린다.
 * 그래서 크기와 내용 모서리가 셋 번 연속 그대로일 때까지 본다.
 */
const POLL_MS = 250
/*
 * 실측에서 게임은 0.5초 간격으로 조금씩 채워 나갔다(1085→1127→1136→1160→1177).
 * 250ms로 보면서 다섯 번 연속 같아야 인정하므로, 그 중간에 멈춘 것을 정착으로 착각하지 않는다.
 */
const STABLE_READS = 5

export async function settledFrame(video, alive, measure = measureFrame) {
  const same = (a, b) => a && b && a.w === b.w && a.h === b.h
    && Math.abs(a.right - b.right) <= 2 && Math.abs(a.bottom - b.bottom) <= 2
  let last = null
  let stable = 0
  for (let i = 0; i < 32; i++) {             // 최대 8초
    if (!alive()) return null
    // 프레임만 기다리면 30fps에서 0.03초 만에 돌아온다 — 간격을 반드시 벌린다
    await Promise.all([new Promise((r) => setTimeout(r, POLL_MS)), nextFrame(video, POLL_MS)])
    if (!alive()) return null
    const m = measure(video)
    if (!m) return null
    if (m.right == null) return m              // 모서리를 못 재면 더 기다릴 것도 없다
    if (!same(m, last)) stable = 0
    else if (++stable >= STABLE_READS) return m
    last = m
  }
  return last
}
