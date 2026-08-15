/**
 * 알림 소리 — AudioContext로 "예약" 재생한다.
 *
 * setTimeout은 백그라운드 탭에서 1초 단위로 뭉개져서 알림이 밀린다.
 * AudioContext는 오디오 하드웨어 시계로 돌아가서 탭이 가려져도 예약 시각이 지켜진다.
 *
 * 음원은 관리자 화면에서 올린 것을 서버에서 받아 쓴다 (RustFS 저장 + DB 관리).
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

/*
 * 음원 목록은 서버에서 받아온다 (관리자 화면에서 추가·정렬).
 * 예전에는 번들 폴더를 훑었는데 음원 하나 추가하려고 코드를 고치고 다시 빌드해야 했다.
 *
 * 저장되는 값은 표시 이름이 아니라 key다 — 이름을 바꾸거나 순서를 옮겨도
 * 이미 고른 소리가 그대로 유지된다.
 */
let sounds = []
const listeners = new Set()

/**
 * 지금 알고 있는 목록 (드롭다운 옵션 형태).
 *
 * 표시 이름은 종류별 순번으로 매긴다 — 관리자가 올린 파일명은 알아보기 어렵고,
 * 목록에서는 "알림 3"처럼 번호로 고르는 편이 낫다. 순서를 바꾸면 번호도 따라 바뀌지만
 * 저장되는 값은 key라 이미 고른 소리는 그대로 유지된다.
 */
export function getSoundOptions() {
  const counts = { alarm: 0, tts: 0 }
  return sounds.map((s) => {
    const kind = s.kind === 'tts' ? 'tts' : 'alarm'
    counts[kind] += 1
    return {
      value: s.key,
      label: `${kind === 'tts' ? '음성' : '알림'} ${counts[kind]}`,
      kind,
      url: s.url,
      file: s.name,
    }
  })
}

/** 목록이 갱신되면 알려준다 — 화면이 다시 그리도록 */
export function subscribeSounds(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

let loading = null
export function loadSounds() {
  if (loading) return loading
  loading = fetch('/api/timer/sounds')
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => {
      sounds = Array.isArray(list) ? list : []
      for (const fn of listeners) fn()
      return sounds
    })
    .catch(() => sounds)
    .finally(() => { loading = null })
  return loading
}

/** 저장된 값이 지금 목록에 없으면(지운 경우) 첫 번째로 되돌린다 */
export function resolveSound(value) {
  return sounds.some((s) => s.key === value) ? value : sounds[0]?.key
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
  await loadSounds()
  await Promise.all(sounds.map(async ({ key: value, url }) => {
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
