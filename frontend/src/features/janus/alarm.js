/**
 * 알림 소리 — AudioContext로 "예약" 재생한다.
 *
 * setTimeout은 백그라운드 탭에서 1초 단위로 뭉개져서 12초 전 알림이 13초, 15초 전으로 밀린다.
 * AudioContext는 오디오 하드웨어 시계로 돌아가서 탭이 가려져도 예약 시각이 그대로 지켜진다.
 */

let ctx = null

/** 사용자 제스처 안에서 불러야 한다 (브라우저 자동재생 정책) */
export function ensureAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

/** 소리별 음 구성 — [주파수(Hz), 시작 오프셋(초), 길이(초)] */
const PATTERNS = {
  bell: [
    [880, 0, 0.5],
    [1320, 0.08, 0.45],
  ],
  beep: [
    [1000, 0, 0.11],
    [1000, 0.18, 0.11],
    [1000, 0.36, 0.11],
  ],
  chime: [
    [660, 0, 0.32],
    [880, 0.16, 0.32],
    [1180, 0.32, 0.5],
  ],
}

/**
 * delaySec 뒤에 소리를 예약한다.
 * 반환된 함수를 호출하면 예약이 취소된다 (리셋·재보정 시 사용).
 */
export function scheduleSound(kind, volume, delaySec) {
  const audio = ensureAudio()
  if (!audio) return () => {}

  const pattern = PATTERNS[kind] || PATTERNS.bell
  const base = audio.currentTime + Math.max(0, delaySec)
  const nodes = []

  for (const [freq, offset, dur] of pattern) {
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq

    const t = base + offset
    // 딸깍거리는 소리가 안 나도록 짧게 올렸다 부드럽게 내린다
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    osc.connect(gain).connect(audio.destination)
    osc.start(t)
    osc.stop(t + dur + 0.05)
    nodes.push(osc)
  }

  return () => {
    for (const osc of nodes) {
      try {
        osc.stop()
        osc.disconnect()
      } catch {
        // 이미 끝난 노드 — 무시
      }
    }
  }
}

/** 지금 바로 한 번 (소리 테스트용) */
export function playSound(kind, volume) {
  return scheduleSound(kind, volume, 0)
}

/* ── 탭 제목 깜빡임 ───────────────────────────────────────── */

let blinkTimer = null
let originalTitle = null

export function blinkTitle(text, times = 6) {
  stopBlink()
  originalTitle = document.title
  let on = false
  let left = times * 2
  blinkTimer = setInterval(() => {
    document.title = on ? originalTitle : text
    on = !on
    if (--left <= 0) stopBlink()
  }, 600)
}

export function stopBlink() {
  if (blinkTimer) {
    clearInterval(blinkTimer)
    blinkTimer = null
  }
  if (originalTitle != null) {
    document.title = originalTitle
    originalTitle = null
  }
}

/* ── 브라우저 알림 ────────────────────────────────────────── */

export async function requestNotifyPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  return (await Notification.requestPermission()) === 'granted'
}

export function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, tag: 'janus-cooldown', renotify: true })
  } catch {
    // 일부 브라우저는 서비스워커 없이 Notification 생성을 막는다 — 소리로 대체됨
  }
}
