/**
 * 알림 소리 — AudioContext로 "예약" 재생한다.
 *
 * setTimeout은 백그라운드 탭에서 1초 단위로 뭉개져서 알림이 밀린다.
 * AudioContext는 오디오 하드웨어 시계로 돌아가서 탭이 가려져도 예약 시각이 지켜진다.
 *
 * 소리는 sounds/ 폴더의 음원 파일뿐이다. 폴더를 통째로 훑으므로
 * 파일을 넣고 다시 빌드하면 코드를 건드리지 않아도 목록에 뜬다.
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

/**
 * 이름표는 파일명 순서대로 "알림 1, 2, …"를 붙이지만,
 * 저장되는 값은 파일명이라 나중에 파일을 추가해 번호가 밀려도
 * 이미 고른 소리는 그대로 유지된다.
 */
const soundFiles = import.meta.glob('./sounds/*.{mp3,ogg,wav,m4a}', {
  eager: true, query: '?url', import: 'default',
})

export const SOUND_OPTIONS = Object.keys(soundFiles)
  .sort((a, b) => a.localeCompare(b))
  .map((path, i) => ({
    value: path.split('/').pop().replace(/\.[^.]+$/, ''),
    label: `알림 ${i + 1}`,
    url: soundFiles[path],
  }))

/** 저장된 값이 지금 목록에 없으면(파일을 지운 경우) 첫 번째로 되돌린다 */
export function resolveSound(value) {
  return SOUND_OPTIONS.some((o) => o.value === value) ? value : SOUND_OPTIONS[0]?.value
}

/* ── 로딩 ─────────────────────────────────────────────────── */

const buffers = new Map()

/**
 * 파일 앞쪽 무음 길이(초). 받아온 효과음은 앞에 0.1초쯤 무음이 붙어 있는 경우가 많은데,
 * 그대로 틀면 그만큼 알림이 늦게 들린다. 재생을 이 지점부터 시작해 소리가 정시에 나게 한다.
 */
function leadingSilence(buffer) {
  const data = buffer.getChannelData(0)
  let peak = 0
  for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]))
  const threshold = peak * 0.02
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) return i / buffer.sampleRate
  }
  return 0
}

/** 미리 받아 디코딩해둔다 — 알림 시각에 네트워크를 기다리지 않도록 */
export async function preloadSounds() {
  const audio = ensureAudio()
  if (!audio) return
  await Promise.all(SOUND_OPTIONS.map(async ({ value, url }) => {
    if (buffers.has(value)) return
    try {
      const res = await fetch(url)
      const buffer = await audio.decodeAudioData(await res.arrayBuffer())
      buffers.set(value, { buffer, offset: leadingSilence(buffer) })
    } catch {
      // 실패를 캐시하면 일시적 네트워크 오류가 "새로고침 전까지 전부 무음"이 된다.
      // 키를 남기지 않아야 다음 preloadSounds가 다시 시도한다.
      buffers.delete(value)
    }
  }))
}

/* ── 재생 ─────────────────────────────────────────────────── */

/**
 * delaySec 뒤에 소리를 예약한다.
 * 반환된 함수를 호출하면 예약이 취소된다 (리셋·재설치 시 사용).
 */
export function scheduleSound(kind, volume, delaySec) {
  const audio = ensureAudio()
  const entry = audio && buffers.get(resolveSound(kind))
  if (!entry) return () => {}

  const src = audio.createBufferSource()
  const gain = audio.createGain()
  src.buffer = entry.buffer
  gain.gain.value = volume
  src.connect(gain).connect(audio.destination)
  const when = audio.currentTime + Math.max(0, delaySec)
  src.start(when, entry.offset)

  return () => {
    // 이미 울리기 시작했으면 건드리지 않는다.
    // 알림이 울리는 도중에 다음 사이클이 시작되면 예약을 다시 잡는데,
    // 그때 울리던 소리까지 끊어버려 알림이 중간에 잘렸다.
    if (audio.currentTime >= when) return
    try {
      src.stop()
      src.disconnect()
    } catch {
      // 이미 끝난 노드 — 무시
    }
  }
}

/** 지금 바로 한 번 (소리 테스트용) */
export function playSound(kind, volume) {
  return scheduleSound(kind, volume, 0)
}
