/**
 * 알림 소리 — AudioContext로 "예약" 재생한다.
 *
 * setTimeout은 백그라운드 탭에서 1초 단위로 뭉개져서 알림이 밀린다.
 * AudioContext는 오디오 하드웨어 시계로 돌아가서 탭이 가려져도 예약 시각이 지켜진다.
 *
 * 소리는 전부 오실레이터로 합성한다 — 음원 파일을 받아오지 않으므로
 * 네트워크가 끊겨 있어도 울리고, 예약 시각도 정확하다.
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

export const SOUND_OPTIONS = [
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
