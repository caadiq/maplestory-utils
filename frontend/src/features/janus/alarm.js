/**
 * 알림 소리 — AudioContext로 "예약" 재생한다.
 *
 * setTimeout은 백그라운드 탭에서 1초 단위로 뭉개져서 알림이 밀린다.
 * AudioContext는 오디오 하드웨어 시계로 돌아가서 탭이 가려져도 예약 시각이 지켜진다.
 *
 * 소리는 두 갈래다.
 *  - 합성음: 오실레이터로 그 자리에서 만든다. 파일이 없어 항상 즉시 준비된다.
 *  - 파일음: public/sounds/janus/ 의 음원. 미리 받아 디코딩해두고 같은 방식으로 예약한다.
 * 둘 다 AudioContext 시계에 얹으므로 예약 정확도는 같다.
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
 * 음 하나: { f: 주파수, t: 시작 오프셋(초), d: 길이(초) }
 *   to     — 이 주파수로 미끄러진다 (없으면 고정음)
 *   type   — 파형 (기본 sine)
 *   g      — 음량 배율 (기본 1)
 *   detune — 살짝 어긋난 배음을 하나 더 깔아 반짝이게 (센트)
 */
const SOUNDS = {
  // 도-솔-도 상행. 마지막 음이 길게 울린다
  ppyorong: [
    { f: 523, t: 0, d: 0.12, type: 'triangle', detune: 7 },
    { f: 784, t: 0.09, d: 0.11, type: 'triangle', detune: 7 },
    { f: 1047, t: 0.18, d: 0.7, type: 'triangle', detune: 7 },
  ],
  bell: [
    { f: 880, t: 0, d: 0.5 },
    { f: 1320, t: 0.08, d: 0.45, g: 0.7 },
  ],
  chime: [
    { f: 660, t: 0, d: 0.32 },
    { f: 880, t: 0.16, d: 0.32 },
    { f: 1180, t: 0.32, d: 0.55 },
  ],
  beep: [
    { f: 1000, t: 0, d: 0.11, type: 'square', g: 0.5 },
    { f: 1000, t: 0.18, d: 0.11, type: 'square', g: 0.5 },
    { f: 1000, t: 0.36, d: 0.11, type: 'square', g: 0.5 },
  ],
  bibip: [
    { f: 1250, t: 0, d: 0.08, type: 'square', g: 0.45 },
    { f: 1250, t: 0.13, d: 0.08, type: 'square', g: 0.45 },
  ],
  // 위로 쭉 훑어 올라감
  rise: [
    { f: 420, to: 1600, t: 0, d: 0.38, type: 'triangle' },
  ],
  // 올라갔다 내려오는 "띠용"
  boing: [
    { f: 320, to: 900, t: 0, d: 0.16, type: 'sawtooth', g: 0.5 },
    { f: 900, to: 380, t: 0.16, d: 0.2, type: 'sawtooth', g: 0.5 },
  ],
  // 물방울
  drop: [
    { f: 1500, to: 620, t: 0, d: 0.16 },
    { f: 1500, to: 620, t: 0.22, d: 0.16, g: 0.6 },
  ],
  // 경보 — 두 음을 번갈아 세 번
  siren: [
    { f: 880, t: 0, d: 0.14, type: 'square', g: 0.4 },
    { f: 660, t: 0.15, d: 0.14, type: 'square', g: 0.4 },
    { f: 880, t: 0.3, d: 0.14, type: 'square', g: 0.4 },
    { f: 660, t: 0.45, d: 0.14, type: 'square', g: 0.4 },
    { f: 880, t: 0.6, d: 0.14, type: 'square', g: 0.4 },
    { f: 660, t: 0.75, d: 0.2, type: 'square', g: 0.4 },
  ],
}

/**
 * 음원 파일 소리 — sounds/ 폴더를 통째로 훑는다.
 * 파일을 넣고 다시 빌드하면 자동으로 목록에 뜬다 (코드는 건드릴 필요 없음).
 *
 * 이름표는 파일명 순서대로 "알림 1, 2, …"를 붙이지만,
 * 저장되는 값은 파일명이라 나중에 파일을 추가해 번호가 밀려도
 * 이미 고른 소리는 그대로 유지된다.
 */
const soundFiles = import.meta.glob('./sounds/*.{mp3,ogg,wav,m4a}', {
  eager: true, query: '?url', import: 'default',
})

export const FILE_SOUNDS = Object.keys(soundFiles)
  .sort((a, b) => a.localeCompare(b))
  .map((path, i) => ({
    value: `file:${path.split('/').pop().replace(/\.[^.]+$/, '')}`,
    label: `알림 ${i + 1}`,
    url: soundFiles[path],
  }))

const SYNTH_OPTIONS = [
  { value: 'ppyorong', label: '뾰롱' },
  { value: 'bell', label: '벨' },
  { value: 'chime', label: '차임' },
  { value: 'beep', label: '비프' },
  { value: 'bibip', label: '삐삡' },
  { value: 'rise', label: '상승' },
  { value: 'boing', label: '띠용' },
  { value: 'drop', label: '물방울' },
  { value: 'siren', label: '경보' },
]

export const SOUND_OPTIONS = [
  ...FILE_SOUNDS.map(({ value, label }) => ({ value, label })),
  ...SYNTH_OPTIONS,
]

/* ── 파일음 ───────────────────────────────────────────────── */

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
export async function preloadFileSounds() {
  const audio = ensureAudio()
  if (!audio) return
  await Promise.all(FILE_SOUNDS.map(async ({ value, url }) => {
    if (buffers.has(value)) return
    try {
      const res = await fetch(url)
      const buffer = await audio.decodeAudioData(await res.arrayBuffer())
      buffers.set(value, { buffer, offset: leadingSilence(buffer) })
    } catch {
      buffers.set(value, null) // 실패하면 합성음으로 대체된다
    }
  }))
}

function scheduleBuffer(audio, entry, volume, delaySec) {
  const src = audio.createBufferSource()
  const gain = audio.createGain()
  src.buffer = entry.buffer
  gain.gain.value = volume
  src.connect(gain).connect(audio.destination)
  src.start(audio.currentTime + Math.max(0, delaySec), entry.offset)
  return src
}

/** 오실레이터 하나를 예약한다 */
function scheduleOsc(audio, note, base, volume, detuneCents = 0) {
  const osc = audio.createOscillator()
  const gain = audio.createGain()
  osc.type = note.type || 'sine'
  if (detuneCents) osc.detune.value = detuneCents

  const t = base + note.t
  osc.frequency.setValueAtTime(note.f, t)
  if (note.to) osc.frequency.exponentialRampToValueAtTime(note.to, t + note.d)

  const peak = Math.max(0.0002, volume * (note.g ?? 1))
  // 딸깍거리지 않도록 짧게 올렸다 부드럽게 내린다
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + note.d)

  osc.connect(gain).connect(audio.destination)
  osc.start(t)
  osc.stop(t + note.d + 0.05)
  return osc
}

/**
 * delaySec 뒤에 소리를 예약한다.
 * 반환된 함수를 호출하면 예약이 취소된다 (리셋·재설치 시 사용).
 */
export function scheduleSound(kind, volume, delaySec) {
  const audio = ensureAudio()
  if (!audio) return () => {}

  const entry = buffers.get(kind)
  if (entry) {
    const src = scheduleBuffer(audio, entry, volume, delaySec)
    return () => { try { src.stop(); src.disconnect() } catch { /* 이미 끝남 */ } }
  }

  const notes = SOUNDS[kind] || SOUNDS.ppyorong
  const base = audio.currentTime + Math.max(0, delaySec)
  const nodes = []

  for (const note of notes) {
    nodes.push(scheduleOsc(audio, note, base, volume))
    // 살짝 어긋난 음을 겹쳐 반짝이는 느낌을 낸다
    if (note.detune) {
      nodes.push(scheduleOsc(audio, { ...note, g: (note.g ?? 1) * 0.5 }, base, volume, note.detune))
    }
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
