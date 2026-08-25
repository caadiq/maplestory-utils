import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import MapleWindow from '../../../components/pc/MapleWindow'
import Select from '../../../components/common/Select'
import { TimerResetIcon, PipIcon, TargetIcon, ScreenOffIcon, BellIcon, IconButton } from './icons'
import { useJanusDetector } from '../useJanusDetector'
import { useRuneDetector, runeKindLabel } from '../useRuneDetector'
import { useRuneMarkDetector } from '../useRuneMarkDetector'

/** 문구·미니맵이 같은 룬을 각각 잡았을 때 알림을 한 번으로 합치는 창 */
const RUNE_ALERT_GAP_MS = 60000
import { useBoosterDetector } from '../useBoosterDetector'
import { useExpStallDetector } from '../useExpStallDetector'
import { usePipWindow } from '../usePipWindow'
import { Toggle } from '../../../components/common/widgets'
import RegionPicker from './RegionPicker'
import RegionPickerModal from './RegionPickerModal'
import CandidatePicker from './CandidatePicker'
import MiniBar from './MiniBar'
import {
  DETECT, loadSettings, saveSettings, durationForSettings, formatSeconds, clearTemplate,
  LEVEL_TIERS, tierForLevel, ALARM_DISPLAY_BIAS_MS, durationLagFor, MODE_LABELS,
} from '../logic'
import { LOCATE } from '../locateCore'
import { ensureAudio, scheduleSound, playSound, preloadSounds, resolveSound, getSoundOptions, subscribeSounds, loadSounds } from '../alarm'

/* 모드 드롭다운 — 라벨 앞에 실제 스킬 아이콘을 붙인다 */
const MODE_ICONS = import.meta.glob('../icon/janus-*.png', { eager: true, query: '?url', import: 'default' })
const modeIcon = (m) => Object.entries(MODE_ICONS).find(([p]) => p.includes(`janus-${m}`))?.[1]
const MODE_OPTIONS = Object.entries(MODE_LABELS).map(([value, label]) => ({
  value, label, subIcon: modeIcon(value),
}))

/**
 * 알림 카드 머리띠 아이콘 — 관리자 이미지 저장소에서 가져온다.
 * 야누스 아이콘만 감지 원본이라 코드에 함께 두고, 나머지는 이미지 관리에서 교체할 수 있게 둔다.
 */
function useStoredIcon(name) {
  const { data } = useQuery({
    queryKey: ['image', name],
    queryFn: () => api(`/api/images/${encodeURIComponent(name)}`).catch(() => null),
    staleTime: Infinity,
  })
  return data?.url ?? null
}

function CardIcon({ url }) {
  if (!url) return null
  return <img src={url} alt="" className="w-[18px] h-[18px] object-contain" />
}

const CARD = { background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }
const SLATE_BAR = {
  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  color: '#ffffff',
  textShadow: '0 1px 1px rgba(44,55,69,.3)',
}

/**
 * 쿨타임 숫자로 설치 시각을 맞추는 중일 때만 띄운다.
 * 맞춰지는 순간 타이머가 살짝 점프하는데, 이유를 모르면 오작동처럼 보인다.
 * 끝나고 나면 알릴 것이 없으므로 조용히 사라진다.
 */
function SyncPill({ sync }) {
  if (sync !== 'pending') return null
  return (
    <span
      className="text-[12.5px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap animate-pulse"
      style={{ color: '#ffd76a', background: 'rgba(255,215,106,.14)', borderColor: 'rgba(255,215,106,.38)' }}
      title="쿨타임 숫자를 읽어 게임 시계에 맞추는 중입니다"
    >
      ⟳ 보정 중
    </span>
  )
}

export default function Timer() {
  const [settings, setSettings] = useState(loadSettings)
  const [picking, setPicking] = useState(false)
  /*
   * 미니맵 지도 영역 — 공유할 때마다 스스로 찾는다(세션 한정).
   * 저장해 두면 화면 구성이 바뀌었을 때 낡은 자리에 굳어 버려서, 매번 찾는 편이 안전하다.
   */
  const [markRegion, setMarkRegion] = useState(null)
  const [markStatus, setMarkStatus] = useState(null)
  const [pickingMark, setPickingMark] = useState(false)
  const [candidates, setCandidates] = useState(null)
  const [locating, setLocating] = useState(false)

  // 알림음 목록은 서버에서 온다 — 관리자 화면에서 추가·정렬한 것이 그대로 보인다
  const [rawSounds, setRawSounds] = useState(getSoundOptions)
  useEffect(() => {
    const off = subscribeSounds(() => setRawSounds(getSoundOptions()))
    loadSounds()
    return off
  }, [])
  /*
   * 효과음과 음성(TTS)을 나눠 보여준다 — 종류가 섞이면 목록에서 찾기 어렵다.
   * Select가 groupStart를 만나면 구분선을 그어 준다.
   */
  const soundOptions = useMemo(() => {
    const alarms = rawSounds.filter((o) => o.kind !== 'tts')
    const tts = rawSounds.filter((o) => o.kind === 'tts')
    return [...alarms, ...tts.map((o, i) => (i === 0 ? { ...o, groupStart: true } : o))]
  }, [rawSounds])

  const runeIconUrl = useStoredIcon('룬')
  const boosterIconUrl = useStoredIcon('VIP 부스터')
  // 부스터 감지가 지금 어디까지 갔는지 (화면에 그대로 보여준다)
  const [boosterStatus, setBoosterStatus] = useState(null)
  const stallIconUrl = useStoredIcon('동작 반복 방지')
  const [stallStatus, setStallStatus] = useState(null)

  // 콜백 안에서 최신 설정을 보기 위한 참조 (모드 자동 전환 판정용)
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  const set = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  /* ── 알림 예약 ──────────────────────────────────────────── */

  const cancelRef = useRef([])

  const clearScheduled = useCallback(() => {
    for (const cancel of cancelRef.current) cancel()
    cancelRef.current = []
  }, [])

  /**
   * installedAt은 "아이콘이 어두워진 순간"이고 확정은 그보다 조금 뒤에 일어나므로,
   * 예약 시각은 지금이 아니라 설치 시각을 기준으로 잡는다.
   */
  const scheduleFor = useCallback((s, installedAt) => {
    clearScheduled()
    if (!s.alarmEnabled) return
    const fireInSec = ((durationForSettings(s) - s.offsetSec) * 1000
      - durationLagFor(s) + ALARM_DISPLAY_BIAS_MS - (Date.now() - installedAt)) / 1000
    if (fireInSec > 0) {
      cancelRef.current.push(scheduleSound(s.sound, s.volume, fireInSec))
    }
  }, [clearScheduled])

  const handleInstall = useCallback((next) => {
    scheduleFor(settings, next.at)
  }, [scheduleFor, settings])

  const resetCycleRef = useRef(null)
  const relocatingRef = useRef(false)

  const isDusk = settings.mode === 'dusk'
  const durationSec = durationForSettings(settings)
  const alarmAtSec = Math.max(0, durationSec - settings.offsetSec)
  /*
   * 사이클(= 다음 감지까지 잠그는 구간)의 길이.
   *
   * 새벽은 설치기라 지속시간이 다 지나야 다시 설치할 수 있다 → 지속시간 그대로.
   * 황혼은 알림이 곧 사이클의 끝이다. 회수하러 다니는 동안에도 몹은 계속 잡히고
   * 그때 떨어진 아이템의 2분은 이미 흐르기 시작한다. 남은 알림초를 채우고 나서
   * 다음 사이클을 시작하면 그 아이템들이 먼저 사라지므로, 알림과 동시에 잠금을 풀어
   * 다음 쿨타임에 바로 이어붙인다.
   */
  const cycleMs = (isDusk ? alarmAtSec : durationSec) * 1000

  const {
    stream, region, setRegion, install, stale, error, iconLost, sync,
    videoRef, start, stop, resetCycle, locate, hasTemplate, log,
  } = useJanusDetector({
    onInstall: handleInstall,
    /*
     * 같은 칸의 아이콘이 다른 모드로 바뀐 경우(캐릭터 변경) 스스로 맞춘다.
     * 사이클·예약 정리는 아래 '모드 변경' effect가 모든 경로에 대해 일괄 수행한다.
     */
    onModeMismatch: (m) => {
      if (settingsRef.current.mode === m) return
      set({ mode: m })
    },
    /*
     * 같은 칸의 스킬을 새벽↔황혼으로 갈아 끼운 경우 — 지정된 자리를 내장 원본 둘과
     * 대조해 스스로 알아챈다. 예전에는 아이콘을 6초 이상 못 알아본 뒤 재탐색이 돌
     * 때만 바뀌어서, 그동안 엉뚱한 모드의 타이머가 돌았다.
     */
    onModeDetected: (m) => {
      if (settingsRef.current.mode === m) return
      set({ mode: m })
      log(`${m === 'dusk' ? '황혼' : '새벽'} 아이콘으로 바뀌었습니다 — 모드 자동 전환`, '자동', 'ok')
    },
    /*
     * 아이콘을 오래 못 알아보면 위치가 어긋난 것 — 자동으로 다시 찾는다.
     * (창을 늘리면 캡처 내용이 줄어들며 지정 자리가 통째로 어긋나는 환경이 있다.
     * 확실하게 찾으면 소리 없이 위치만 갱신되고, 애매하면 후보 화면이 뜬다.)
     */
    onIconLostTooLong: async () => {
      if (relocatingRef.current) return
      relocatingRef.current = true
      try {
        log('아이콘을 계속 못 알아봄 — 자리를 다시 찾습니다', '자동', 'warn')
        applyHits(await locate(), { auto: true })
      } finally {
        relocatingRef.current = false
      }
    },
    mode: settings.mode,
    cycleMs,
    // 스위치를 끄면 소리뿐 아니라 감지·타이머까지 멈춘다 (룬·부스터 스위치와 같은 동작)
    enabled: settings.alarmEnabled,
  })

  useEffect(() => { resetCycleRef.current = resetCycle }, [resetCycle])

  /*
   * 룬 등장 감지 — 야누스와 독립으로, 공유 화면 상단 띠에서 "등장" 문구를 지켜본다.
   * 감지되면 즉시 울린다 (예약할 것이 없다 — 문구가 떴다는 것 자체가 알림 시점).
   */
  /*
   * 문구와 미니맵 표식은 **같은 룬**을 각자 잡을 수 있다. 그대로 두면 한 번의 룬에
   * 알림이 두 번 울린다 — 먼저 울린 쪽이 이기고 잠시 다른 쪽을 막는다.
   */
  const runeFiredAtRef = useRef(0)
  const fireRune = (label, detail) => {
    if (Date.now() - runeFiredAtRef.current < RUNE_ALERT_GAP_MS) return
    runeFiredAtRef.current = Date.now()
    const s = settingsRef.current
    playSound(resolveSound(s.runeSound), s.runeVolume)
    log(label, detail, 'ok')
  }

  useRuneDetector({
    videoRef,
    stream,
    enabled: settings.runeEnabled,
    onRune: (hit) => fireRune(`${runeKindLabel(hit.kind)} 등장 감지`, `문구 · 일치 ${hit.score.toFixed(2)}`),
  })

  /*
   * 미니맵 룬 표식 — 문구와 **함께** 돈다.
   * 문구는 다른 UI 창에 가려지고, 표식은 룬이 발밑에 뜨면 내 마커에 가린다.
   * 서로 막히는 상황이 달라서 둘 다 켜 두면 놓치는 룬이 줄어든다.
   * 한쪽이 이미 울렸으면 다른 쪽은 억제 시간(90초) 안이라 연타되지 않는다.
   */
  // 공유가 끊기면 미니맵 자리도 잊는다 — 다음 공유는 화면 구성이 다를 수 있다
  useEffect(() => {
    if (!stream) { setMarkRegion(null); setMarkStatus(null); setPickingMark(false) }
  }, [stream])

  useRuneMarkDetector({
    videoRef,
    stream,
    enabled: settings.runeEnabled && settings.runeMarkEnabled,
    region: markRegion,
    onRegion: (r, info) => {
      setMarkRegion(r)
      if (info?.auto) log('미니맵 위치를 찾았습니다', `일치 ${info.score.toFixed(2)}`, 'muted')
    },
    onStatus: setMarkStatus,
    onRune: (hit) => fireRune('룬 등장 감지', `미니맵 표식 · 일치 ${hit.score.toFixed(2)}`),
  })

  /*
   * VIP 부스터 — 남은시간을 읽어 0초가 되는 순간에 울리도록 미리 예약한다.
   * 마지막 순간에 박스가 가려도(이펙트·인벤토리 창) 정시에 울린다.
   */
  useBoosterDetector({
    videoRef,
    stream,
    enabled: settings.boosterEnabled,
    // 진행 중 예약에 소리·크기 변경을 반영하기 위한 신호 — 값이 바뀌면 훅이 다시 단다
    soundSignature: `${resolveSound(settings.boosterSound)}|${settings.boosterVolume}`,
    onSchedule: (delaySec) => {
      const s = settingsRef.current
      return scheduleSound(resolveSound(s.boosterSound), s.boosterVolume, delaySec)
    },
    onDetect: (hit) => log(`부스터 ${hit.seconds}초 남음`, '부스터', 'muted'),
    /*
     * 스캔은 1초마다 도는데 대부분은 부스터가 없는 상태다.
     * 그때마다 상태를 갈아끼우면 화면만 계속 다시 그려지므로, 보여줄 내용이
     * 실제로 달라졌을 때만 바꾼다.
     */
    onStatus: (st) => setBoosterStatus((prev) => {
      const next = st.reason === 'ok' || st.reason === 'digit' ? st : null
      if (!prev && !next) return prev
      if (prev && next && prev.reason === next.reason && prev.seconds === next.seconds && prev.digitScore === next.digitScore) return prev
      return next
    }),
  })

  /*
   * 동꼽 알림 — 경험치가 멈추면 울린다.
   * 예약이 아니라 그 자리에서 바로 울린다. 언제 걸릴지는 미리 알 수 없고
   * 지나고 나서야 아는 상태라 미리 잡아둘 시각이 없다.
   */
  useExpStallDetector({
    videoRef,
    stream,
    enabled: settings.stallEnabled,
    stallSec: settings.stallSec,
    repeat: settings.stallRepeat,
    repeatSec: settings.stallRepeatSec,
    onAlert: (stillSec) => {
      const s = settingsRef.current
      playSound(resolveSound(s.stallSound), s.stallVolume)
      log(`경험치 ${stillSec}초째 멈춤`, '동꼽', 'warn')
    },
    onStatus: (st) => setStallStatus((prev) => {
      if (!prev && !st) return prev
      if (prev && st && prev.reason === st.reason && prev.stillSec === st.stillSec) return prev
      return st
    }),
  })

  /* ── 표시값 ─────────────────────────────────────────────── */

  const soundValue = resolveSound(settings.sound)
  const installedAt = install ? install.at : 0
  const elapsed = install ? Date.now() - installedAt : 0
  const active = Boolean(install) && elapsed < cycleMs
  // 표시도 실제 울리는 시각과 같아야 한다
  const alarmInMs = active
    ? alarmAtSec * 1000 - durationLagFor(settings) + ALARM_DISPLAY_BIAS_MS - elapsed
    : null
  const countdownMs = alarmInMs
  const progress = active ? elapsed / cycleMs : 0

  const pip = usePipWindow()

  const handleStart = async () => {
    ensureAudio() // 사용자 제스처 안에서 오디오를 깨워둔다 (예약이 안 울리는 걸 방지)
    preloadSounds() // 음원을 미리 받아둔다 — 알림 시각에 네트워크를 기다리지 않도록
    const ok = await start()
    if (!ok || region) return

    // 전에 지정한 적이 있으면 화면에서 아이콘을 자동으로 찾아본다
    if (!hasTemplate) { setPicking(true); return }
    setLocating(true)
    // 영상이 실제로 흐르기 시작할 때까지 잠깐 기다린다
    await new Promise((r) => setTimeout(r, 700))
    applyHits(await locateWithRetry())
  }

  /*
   * 빈손이면 텀을 두고 몇 번 더 찾는다.
   * 쿨타임 숫자·시전 플래시가 덮인 순간에는 어떤 템플릿으로도 점수가 낮은데,
   * 황혼은 쿨타임이 3초라 잠깐만 기다리면 멀쩡한 모습이 돌아온다.
   */
  const locateWithRetry = async (opts) => {
    for (let attempt = 0; ; attempt++) {
      const found = await locate(opts)
      if (found?.hits?.length || attempt >= 3) return found
      log('아이콘을 못 찾음 — 쿨타임 중일 수 있어 잠시 후 다시 찾습니다', '자동', 'muted')
      await new Promise((r) => setTimeout(r, 2500))
    }
  }

  /**
   * 확실한 것이 딱 하나면 바로 쓰고, 애매하면 고르게 한다.
   * 실제 게임 아이콘은 단축키 글자와 슬롯 테두리가 겹쳐 점수가 깎이므로
   * 통과선을 못 넘었다고 곧장 수동으로 보내지 않는다.
   *
   * auto = 사용자가 부른 게 아니라 스스로 도는 재탐색.
   * 이때는 확실할 때만 자리를 옮기고, 애매하면 아무것도 하지 않는다 —
   * 캐릭터 변경으로 아이콘이 화면에서 사라진 동안에도 탐색은 무언가를 집어내는데,
   * 그걸 후보로 띄우면 게임 중에 엉뚱한 화면이 튀어나온다(실사용 보고).
   */
  const applyHits = (found, { auto = false } = {}) => {
    setLocating(false)
    /*
     * 새벽/황혼 아이콘을 모두 대조하므로 이긴 쪽이 곧 현재 장착 모드다.
     * 실측(1080p): 황혼이 끼워진 화면에서 황혼 원본은 0.890으로 1위, 새벽 원본은 10위 밖 —
     * 구분이 확실해서 자동으로 맞춰도 안전하다.
     */
    if (found?.detectedMode && found.detectedMode !== settingsRef.current.mode) {
      set({ mode: found.detectedMode })
      log(`${found.detectedMode === 'dusk' ? '황혼' : '새벽'} 아이콘으로 인식 — 모드 자동 전환`, '자동', 'ok')
    }
    const hits = found?.hits
    if (!hits?.length) {
      if (!auto) setPicking(true)
      return
    }
    const [best, second] = hits
    const learnedScore = auto ? LOCATE.autoSureScore : LOCATE.sureScore
    const learnedMargin = auto ? LOCATE.autoSureMargin : LOCATE.sureMargin
    const minScore = found.learned ? learnedScore : Math.max(LOCATE.builtinSureScore, auto ? LOCATE.autoSureScore : 0)
    const minMargin = found.learned ? learnedMargin : LOCATE.builtinSureMargin
    const clear = best.score >= minScore
      && (!second || best.score - second.score >= minMargin)
    if (clear) {
      setRegion(best.region)
      if (auto) log(`자리를 다시 잡았습니다 (일치 ${best.score.toFixed(2)})`, '자동', 'ok')
      return
    }
    // 자동일 땐 확신이 없으면 그냥 넘어간다 — 다음 기회에 다시 돈다
    if (auto) log(`자리를 확정하지 못해 넘어갑니다 (최고 ${best.score.toFixed(2)})`, '자동', 'muted')
    else setCandidates(hits.slice(0, 6))
  }

  /*
   * 다시 찾기 = 기억해둔 모양을 버리고 내장 원본으로 새로 찾는다.
   *
   * 저장 모양을 그대로 두면 자기 자신과 맞춰 점수가 1.0이라, 한 번 엉뚱한 자리가
   * 저장되면 몇 번을 눌러도 같은 자리만 다시 나온다(내장 원본이 0.89로 옳게 찾아도 진다).
   * 이 버튼을 누른다는 건 지금 자리가 틀렸다는 뜻이므로 그 기억부터 지우는 게 맞다.
   */
  const relocate = async () => {
    setLocating(true)
    await new Promise((r) => setTimeout(r, 50))
    clearTemplate()
    applyHits(await locateWithRetry({ ignoreSaved: true }))
  }

  const handleTest = async () => {
    // 아직 못 받았을 수 있다 — 받아두고 눌러야 소리가 난다
    await preloadSounds()
    playSound(soundValue, settings.volume)
  }

  const handleRuneTest = async () => {
    await preloadSounds()
    playSound(resolveSound(settings.runeSound), settings.runeVolume)
  }

  const handleBoosterTest = async () => {
    await preloadSounds()
    playSound(resolveSound(settings.boosterSound), settings.boosterVolume)
  }

  const handleStallTest = async () => {
    await preloadSounds()
    playSound(resolveSound(settings.stallSound), settings.stallVolume)
  }

  useEffect(() => () => clearScheduled(), [clearScheduled])

  /*
   * 사이클이 사라지면 예약해둔 알림도 거둔다.
   * 공유를 중단하거나 초기화를 눌러도 예약은 AudioContext에 그대로 남아 있어서
   * 화면을 다 정리한 뒤에 알림이 울렸다.
   */
  useEffect(() => {
    if (!install || !stream) clearScheduled()
  }, [install, stream, clearScheduled])

  // 설정을 바꾸면 진행 중인 예약도 새 값으로 다시 잡는다.
  // 변경으로 사이클이 이미 끝난 셈이 되면(elapsed > 새 cycleMs) 옛 예약을 거둬야 한다 —
  // 화면은 '종료'인데 소리만 옛 시각에 울리는 일이 있었다.
  useEffect(() => {
    if (!install) return
    if (active) scheduleFor(settings, installedAt)
    else clearScheduled()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.offsetSec, settings.sound, settings.volume, settings.level, settings.alarmEnabled])

  /*
   * 모드가 바뀌면(수동 드롭다운·자동 탐색·불일치 교정 어느 경로든) 진행 중인
   * 사이클과 예약을 정리한다. 사이클 길이·알림 수식이 모드마다 달라서,
   * 옛 모드 기준의 예약이 남으면 표시와 무관한 시각에 소리가 울린다.
   */
  const prevModeRef = useRef(settings.mode)
  useEffect(() => {
    if (prevModeRef.current === settings.mode) return
    prevModeRef.current = settings.mode
    clearScheduled()
    resetCycleRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mode])

  /* ── 감시 중 ────────────────────────────────────────────── */

  return (
    <MapleWindow
      title="JANUS ALARM"
      className="max-w-[900px] mx-auto"
      titleRight={(
        <div className="flex items-center gap-2">
          {stale && <Badge tone="warn">⚠ 화면이 갱신되지 않음</Badge>}
          <Badge tone={!settings.alarmEnabled ? 'wait' : active ? 'live' : 'wait'}>{!settings.alarmEnabled
            ? '○ 야누스 알림 꺼짐'
            : active
              ? `● ${settings.mode === 'dusk' ? '회수까지' : '유지 중'} · ${install.index}회차`
              : (settings.mode === 'dusk' ? '● 쿨타임 대기' : '● 설치 대기')}</Badge>
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
      <div className="rounded-[11px] overflow-hidden relative" style={CARD}>
        {stream ? (
          <RegionPicker videoRef={videoRef} stream={stream} region={region} />
        ) : (
          <Intro onStart={handleStart} error={error} />
        )}

        {stream && (
          <div className="absolute left-4 bottom-4 flex flex-col items-start gap-2.5">
            {/* 타이머는 설치를 잡았을 때만 — 대기 중에 빈 숫자를 띄워둘 이유가 없다 */}
            {install && (
              <div
                className="rounded-2xl px-5 py-4"
                style={{
                  background: 'rgba(8,13,19,.78)',
                  border: '1px solid rgba(255,255,255,.13)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold tracking-wide" style={{ color: 'var(--mpl-title-yellow)' }}>
                    다음 알림까지
                  </span>
                  <SyncPill sync={sync} />
                </div>
                {countdownMs != null && countdownMs > 0 ? (
                  <div
                    className="font-extrabold tabular-nums leading-[.95]"
                    style={{ fontSize: 64, letterSpacing: '-2.5px', color: '#eef3f8' }}
                  >
                    {formatSeconds(countdownMs).split('.')[0]}
                    <span style={{ fontSize: 30, letterSpacing: 0 }}>.{formatSeconds(countdownMs).split('.')[1]}</span>
                  </div>
                ) : (
                  <div className="font-extrabold leading-[1.3]" style={{ fontSize: 38, color: '#8ba0b4' }}>
                    {isDusk ? '쿨타임 대기' : '지속시간 종료'}
                  </div>
                )}
              </div>
            )}

            <div
              className="flex gap-2 rounded-2xl px-3 py-2.5"
              style={{
                background: 'rgba(8,13,19,.78)',
                border: '1px solid rgba(255,255,255,.13)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <IconButton tone="slate" label="타이머 초기화" onClick={resetCycle}><TimerResetIcon /></IconButton>
              {pip.supported && (
                <IconButton
                  tone="sky"
                  label={pip.pip ? '미니 HUD 닫기' : '미니 HUD 열기'}
                  onClick={() => (pip.pip ? pip.close() : pip.open())}
                >
                  <PipIcon />
                </IconButton>
              )}
              <IconButton tone="slate" label="야누스 아이콘 다시 찾기" onClick={relocate}><TargetIcon /></IconButton>
              <IconButton tone="red" label="화면 공유 중단" onClick={stop}><ScreenOffIcon /></IconButton>
            </div>
          </div>
        )}

        {stream && (
          <div className="absolute left-0 right-0 bottom-0 h-[5px]" style={{ background: 'rgba(8,13,19,.55)' }}>
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                background: 'linear-gradient(90deg, var(--mpl-sky-from), var(--mpl-sky-to))',
              }}
            />
          </div>
        )}

        {stream && !region && settings.alarmEnabled && (
          <div
            className="absolute left-0 right-0 top-0 px-3 py-2 text-[12.5px] font-bold"
            style={{ background: 'rgba(10,16,22,.85)', color: '#ffe437' }}
          >
            퀵슬롯의 야누스 아이콘을 지정해 주세요
          </div>
        )}

        {stream && region && settings.alarmEnabled && (stale || iconLost) && (
          <div
            className="absolute left-0 right-0 top-0 px-3 py-2 text-[12.5px] font-bold"
            style={{ background: 'rgba(10,16,22,.85)', color: '#ffcb6b' }}
          >
            {stale
              ? '⚠ 화면이 갱신되지 않습니다 — 게임 창이 최소화됐거나 가려졌는지 확인해 주세요'
              : '⚠ 야누스 아이콘이 보이지 않습니다 — 가려졌거나 퀵슬롯이 이동했다면 영역을 다시 지정해 주세요'}
          </div>
        )}
      </div>

      {/* 설정 — 알림별 카드. 헤더 스위치로 소리만 켜고 끈다 (감지·타이머 표시는 유지) */}
      <div className="rounded-[11px] overflow-hidden" style={CARD}>
        <SectionBar
          icon={modeIcon(settings.mode) && (
            <img src={modeIcon(settings.mode)} alt="" className="w-[18px] h-[18px] rounded-[4px]" />
          )}
          title="야누스 알림"
          on={settings.alarmEnabled}
          onChange={(v) => set({ alarmEnabled: v })}
        />
        <div style={settings.alarmEnabled ? undefined : { opacity: 0.45, pointerEvents: 'none' }}>
        <SettingRow
          name="야누스 모드"
          desc={settings.mode === 'dusk'
            ? '쿨타임이 처음 도는 순간부터 2분을 재고, 끝나면 다시 감지합니다'
            : '설치 순간을 잡아 지속시간을 셉니다'}
        >
          <div className="w-[172px]">
            <Select
              options={MODE_OPTIONS}
              value={settings.mode}
              onChange={(v) => set({ mode: v })}
            />
          </div>
        </SettingRow>

        {settings.mode !== 'dusk' && (
          <SettingRow name="스킬 레벨" desc="레벨로 지속시간이 정해집니다">
            <div className="w-[140px]">
              <Select
                showSub
                options={LEVEL_TIERS}
                value={tierForLevel(settings.level)}
                onChange={(v) => set({ level: v })}
              />
            </div>
          </SettingRow>
        )}

        <SettingRow
          name="알림 시점"
          desc={settings.mode === 'dusk'
            ? <>아이템이 사라지기 <b style={{ color: 'var(--text-muted)' }}>{settings.offsetSec}초</b> 전에 알립니다</>
            : <>지속시간이 <b style={{ color: 'var(--text-muted)' }}>{settings.offsetSec}초</b> 남았을 때 알립니다</>}
        >
          <NumberField
            value={settings.offsetSec}
            min={1}
            max={Math.max(1, durationSec - 1)}
            unit="초 전"
            chars={2}
            onChange={(v) => set({ offsetSec: Math.max(1, v || 1) })}
          />
        </SettingRow>

        <SettingRow name="알림 소리" desc="백그라운드 탭에서도 정확한 시각에 울립니다">
          <SoundControl
            options={soundOptions}
            sound={soundValue}
            volume={settings.volume}
            onSound={(v) => set({ sound: v })}
            onVolume={(v) => set({ volume: v })}
            onTest={handleTest}
          />
        </SettingRow>
        </div>
      </div>

      <div className="rounded-[11px] overflow-hidden" style={CARD}>
        <SectionBar
          icon={<CardIcon url={runeIconUrl} />}
          title="룬 알림"
          on={settings.runeEnabled}
          onChange={(v) => set({ runeEnabled: v })}
        />
        <div style={settings.runeEnabled ? undefined : { opacity: 0.45, pointerEvents: 'none' }}>
        <SettingRow
          name="미니맵 표식"
          desc={settings.runeMarkEnabled
            ? <>문구와 함께 미니맵의 <b style={{ color: 'var(--text-muted)' }}>분홍 마름모</b>도 지켜봅니다{markStatusText(stream, markRegion, markStatus)}</>
            : '화면 상단 문구만 지켜봅니다'}
        >
          {settings.runeMarkEnabled && stream && (
            <TextButton onClick={() => setPickingMark(true)}>
              {markRegion ? '위치 바꾸기' : '직접 지정'}
            </TextButton>
          )}
          <Toggle on={settings.runeMarkEnabled} onChange={(v) => { set({ runeMarkEnabled: v }); if (!v) setMarkRegion(null) }} />
        </SettingRow>
        <SettingRow
          name="알림 소리"
          desc={<>화면에 <b style={{ color: 'var(--text-muted)' }}>룬 등장 문구</b>가 뜨면 바로 알립니다</>}
        >
          <SoundControl
            options={soundOptions}
            sound={resolveSound(settings.runeSound)}
            volume={settings.runeVolume}
            onSound={(v) => set({ runeSound: v })}
            onVolume={(v) => set({ runeVolume: v })}
            onTest={handleRuneTest}
          />
        </SettingRow>
        </div>
      </div>

      <div className="rounded-[11px] overflow-hidden" style={CARD}>
        <SectionBar
          icon={<CardIcon url={boosterIconUrl} />}
          title="부스터 알림"
          on={settings.boosterEnabled}
          onChange={(v) => set({ boosterEnabled: v })}
          right={stream && settings.boosterEnabled && <BoosterStatus status={boosterStatus} />}
        />
        <div style={settings.boosterEnabled ? undefined : { opacity: 0.45, pointerEvents: 'none' }}>
        <SettingRow
          name="알림 소리"
          desc={<>부스터 <b style={{ color: 'var(--text-muted)' }}>남은시간이 0</b>이 되는 순간에 알립니다</>}
        >
          <SoundControl
            options={soundOptions}
            sound={resolveSound(settings.boosterSound)}
            volume={settings.boosterVolume}
            onSound={(v) => set({ boosterSound: v })}
            onVolume={(v) => set({ boosterVolume: v })}
            onTest={handleBoosterTest}
          />
        </SettingRow>
        </div>
      </div>

      <div className="rounded-[11px] overflow-hidden" style={CARD}>
        <SectionBar
          icon={<CardIcon url={stallIconUrl} />}
          title="동작 반복 방지 알림"
          on={settings.stallEnabled}
          onChange={(v) => set({ stallEnabled: v })}
          right={stream && settings.stallEnabled && <StallStatus status={stallStatus} />}
        />
        <div style={settings.stallEnabled ? undefined : { opacity: 0.45, pointerEvents: 'none' }}>
        <SettingRow
          name="판정 시간"
          desc={<>화면 아래 <b style={{ color: 'var(--text-muted)' }}>경험치 숫자</b>가 {settings.stallSec}초 동안 안 오르면 알립니다</>}
        >
          <NumberField
            value={settings.stallSec}
            min={5}
            max={180}
            unit="초"
            chars={3}
            onChange={(v) => set({ stallSec: Math.min(180, Math.max(5, v || 5)) })}
          />
        </SettingRow>
        <SettingRow
          name="반복 알림"
          desc={settings.stallRepeat
            ? <>풀릴 때까지 <b style={{ color: 'var(--text-muted)' }}>{settings.stallRepeatSec}초</b> 간격으로 다시 알립니다</>
            : '걸린 시점에 한 번만 알립니다'}
        >
          {settings.stallRepeat && (
            <NumberField
              value={settings.stallRepeatSec}
              min={5}
              max={300}
              unit="초"
              chars={3}
              onChange={(v) => set({ stallRepeatSec: Math.min(300, Math.max(5, v || 5)) })}
            />
          )}
          <Toggle on={settings.stallRepeat} onChange={(v) => set({ stallRepeat: v })} />
        </SettingRow>
        <SettingRow name="알림 소리" desc="경험치가 다시 오르면 알림이 멎습니다">
          <SoundControl
            options={soundOptions}
            sound={resolveSound(settings.stallSound)}
            volume={settings.stallVolume}
            onSound={(v) => set({ stallSound: v })}
            onVolume={(v) => set({ stallVolume: v })}
            onTest={handleStallTest}
          />
        </SettingRow>
        </div>
      </div>
      </div>

      {locating && (
        <div
          className="fixed inset-0 z-50 grid place-items-center"
          style={{ background: 'rgba(4,8,14,.7)', color: '#eef3f8' }}
        >
          <div className="text-[14px] font-extrabold">화면에서 야누스 아이콘을 찾는 중…</div>
        </div>
      )}

      {candidates && (
        <CandidatePicker
          videoRef={videoRef}
          candidates={candidates}
          onPick={(r) => { setRegion(r); setCandidates(null) }}
          onManual={() => { setCandidates(null); setPicking(true) }}
          onClose={() => setCandidates(null)}
        />
      )}

      {pickingMark && (
        <RegionPickerModal
          stream={stream}
          region={markRegion}
          onConfirm={(r) => { setMarkRegion(r); setPickingMark(false); log('미니맵 영역 지정', '사용자', 'muted') }}
          onClose={() => setPickingMark(false)}
        />
      )}

      {picking && (
        <RegionPickerModal
          stream={stream}
          region={region}
          onConfirm={(r) => { setRegion(r); setPicking(false); log('인식 영역 지정', '사용자', 'muted') }}
          onClose={() => setPicking(false)}
        />
      )}

      {pip.pip && createPortal(
        <div style={{ padding: 8 }}>
          <MiniBar
            active={active}
            remainingMs={countdownMs}
            idleLabel={isDusk ? '쿨타임 대기' : '설치 대기'}
            progress={progress}
            cycleIndex={install?.index ?? 0}
            sync={sync}
            onReset={resetCycle}
          />
        </div>,
        pip.pip.document.body
      )}
    </MapleWindow>
  )
}

/* ── 화면 공유 전 안내 (창 안에 그대로 들어간다) ─────────── */

function Intro({ onStart, error }) {
  return (
    <div
      className="w-full flex flex-col items-center justify-center text-center gap-4 px-6"
      style={{ aspectRatio: '16 / 9', background: '#0e1620' }}
    >
      <div>
        <h2 className="text-[17px] font-extrabold" style={{ color: '#eef3f8' }}>야누스 알림</h2>
        <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: '#9db0c2' }}>
          메이플 창을 공유하면 퀵슬롯의 야누스 아이콘을 지켜보다가<br />
          사라지기 전에 소리로 알려줍니다.
        </p>
      </div>

      <ol className="text-left text-[13px] flex flex-col gap-1.5" style={{ color: '#cfdae4' }}>
        <Step n={1}>아래 버튼을 눌러 <b>메이플스토리 창</b>을 선택합니다</Step>
        <Step n={2}>퀵슬롯의 <b>야누스 아이콘</b>을 드래그해서 지정합니다</Step>
        <Step n={3}>설치하면 자동으로 타이머가 시작됩니다</Step>
      </ol>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onStart}
          className="rounded-[10px] px-5 py-2.5 text-[13.5px] font-extrabold text-white"
          style={{
            background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), 0 3px 8px rgba(0,0,0,.25)',
          }}
        >
          🖥️ 화면 공유 시작
        </button>
      </div>

      {error && <p className="text-[12.5px]" style={{ color: '#ef8078' }}>{error}</p>}
      <p className="text-[12px] leading-relaxed" style={{ color: '#64788c' }}>
        공유 화면은 이 브라우저 안에서만 처리되고 어디로도 전송되지 않습니다.<br />
        브라우저 정책상 페이지를 새로 열면 창을 다시 골라야 합니다.
      </p>
    </div>
  )
}

/* ── 설정 ─────────────────────────────────────────────────── */

/* ── 작은 조각들 ──────────────────────────────────────────── */

function Step({ n, children }) {
  return (
    <li className="flex items-center gap-2.5">
      <span
        className="w-[21px] h-[21px] rounded-full grid place-items-center text-[12px] font-bold text-white shrink-0"
        style={{ background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))' }}
      >
        {n}
      </span>
      {children}
    </li>
  )
}

function Badge({ tone, children }) {
  const styles = {
    live: { color: '#b6e77c', background: 'rgba(159,212,94,.16)', borderColor: 'rgba(159,212,94,.42)' },
    wait: { color: '#cfdae4', background: 'rgba(207,218,228,.12)', borderColor: 'rgba(207,218,228,.3)' },
    warn: { color: '#ffcb6b', background: 'rgba(255,203,107,.14)', borderColor: 'rgba(255,203,107,.4)' },
  }
  return (
    <span className="text-[12px] font-extrabold px-2 py-0.5 rounded border" style={styles[tone]}>
      {children}
    </span>
  )
}


/** 알림 카드 머리띠 — 제목과 켬/끔 스위치. 꺼도 감지·표시는 돌고 소리만 쉰다 */
function SectionBar({ icon, title, on, onChange, right }) {
  return (
    <div className="px-4 py-2 flex items-center justify-between" style={SLATE_BAR}>
      <span className="flex items-center gap-2 text-[13.5px] font-extrabold">{icon}{title}</span>
      <span className="flex items-center gap-2.5">
        {right}
        <Toggle on={on} onChange={onChange} />
      </span>
    </div>
  )
}

/**
 * 부스터 감지 상태 — 공유 중일 때만 띄운다.
 * 안 울릴 때 어디서 막힌 건지(화면에서 박스를 못 찾는 건지, 찾고도 숫자를 못 읽는 건지)
 * 바로 보이게 하려고 둔다.
 */
function BoosterStatus({ status }) {
  // 부스터가 안 돌 때(대부분의 시간)는 아무것도 띄우지 않는다 — 상시 표시할 값이 아니다
  if (!status) return null
  if (status.reason === 'ok') return <StatusPill tone="live">남은시간 {status.seconds}초</StatusPill>
  if (status.reason === 'digit') {
    return (
      <StatusPill tone="warn">
        숫자 인식 실패 (라벨 {status.labelScore.toFixed(2)} · 숫자 {(status.digitScore ?? 0).toFixed(2)})
      </StatusPill>
    )
  }
  return null
}

/**
 * 동꼽 감지 상태.
 * 'waiting'은 첫 변화를 아직 못 본 상태 — 게임 창이 아니라 화면 전체를 공유했거나
 * 경험치 표시가 꺼져 있으면 여기서 안 넘어간다. 그대로 보여줘야 원인을 알 수 있다.
 */
function StallStatus({ status }) {
  if (!status) return null
  if (status.reason === 'stall') return <StatusPill tone="warn">경험치 {status.stillSec}초째 멈춤</StatusPill>
  if (status.reason === 'ok') return <StatusPill tone="live">경험치 오르는 중</StatusPill>
  if (status.reason === 'notext') return <StatusPill tone="wait">경험치 숫자 안 보임</StatusPill>
  return <StatusPill tone="wait">경험치 확인 중</StatusPill>
}

function StatusPill({ tone, children }) {
  const styles = {
    live: { color: '#b6e77c', background: 'rgba(159,212,94,.18)' },
    warn: { color: '#ffcb6b', background: 'rgba(255,203,107,.18)' },
    wait: { color: '#cfdae4', background: 'rgba(207,218,228,.16)' },
  }
  return (
    <span className="text-[12px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap tabular-nums" style={styles[tone]}>
      {children}
    </span>
  )
}

/** 소리 선택 + 테스트 + 크기 — 음원마다 원래 크기가 달라 알림별로 따로 조절한다 */
function SoundControl({ sound, volume, options, onSound, onVolume, onTest }) {
  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex items-center gap-2">
        <div className="w-[126px]">
          <Select options={options} value={sound} onChange={onSound} />
        </div>
        <IconButton tone="tan" label="소리 테스트" size={36} onClick={onTest}><BellIcon /></IconButton>
      </div>
      <div className="flex items-center gap-2.5">
        <input
          type="range" min={0} max={100} value={Math.round(volume * 100)}
          onChange={(e) => onVolume(Number(e.target.value) / 100)}
          className="janus-range w-[130px]"
          aria-label="소리 크기"
        />
        <span className="text-[13px] font-bold tabular-nums w-[38px] text-right" style={{ color: 'var(--text-muted)' }}>
          {Math.round(volume * 100)}%
        </span>
      </div>
    </div>
  )
}

/** 설정 한 줄 — 이름 / 설명 / 컨트롤 */
/** 미니맵 자리를 잡았는지 한 줄로 알려 준다 */
function markStatusText(stream, region, status) {
  if (!stream) return null
  const tone = { color: 'var(--text-muted)' }
  if (region) return <> · <b style={tone}>자리 확인됨</b></>
  if (status?.reason === 'nomap') return <> · <b style={tone}>미니맵을 못 찾았습니다 — 직접 지정해 주세요</b></>
  return <> · <b style={tone}>미니맵을 찾는 중…</b></>
}

/** 글자만 있는 작은 버튼 — 행 안에서 컨트롤 옆에 붙는다 */
function TextButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[8px] px-2.5 py-1.5 text-[13px] font-bold"
      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-dim)' }}
    >
      {children}
    </button>
  )
}

function SettingRow({ name, desc, children }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3" style={{ borderTop: '1px solid var(--mpl-card-line)' }}>
      <span className="w-[112px] shrink-0 text-[15px] font-bold" style={{ color: 'var(--text-emphasis)' }}>{name}</span>
      <span className="flex-1 min-w-0 text-[14px]" style={{ color: 'var(--text-dim)' }}>{desc}</span>
      {/* 컨트롤 폭은 항목마다 다르다 — 굳이 맞추면 짧은 입력칸이 쓸데없이 늘어난다 */}
      <span className="shrink-0 flex items-center gap-2.5">{children}</span>
    </div>
  )
}

/** 숫자 + 단위 입력칸. 화살표로 한 칸씩 올리고 내릴 수 있다 */
function NumberField({ value, min, max, step = 1, unit, chars = 2, onChange }) {
  const nudge = (d) => {
    const next = Math.round((Number(value) + d) * 10) / 10
    onChange(Math.min(max, Math.max(min, next)))
  }
  return (
    <div
      className="flex items-center gap-1.5 rounded-[9px] pl-3 pr-1 py-1.5"
      style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
    >
      <input
        type="number" min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="janus-num text-[14px] font-semibold tabular-nums bg-transparent outline-none"
        style={{ width: `${chars}ch`, color: 'var(--text-strong)' }}
      />
      <span className="text-[13px] font-bold shrink-0" style={{ color: 'var(--text-dim)' }}>{unit}</span>
      <span className="flex flex-col shrink-0">
        <Nudge label="1 올리기" onClick={() => nudge(step)} up />
        <Nudge label="1 내리기" onClick={() => nudge(-step)} />
      </span>
    </div>
  )
}

function Nudge({ label, onClick, up = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="w-4 h-[13px] grid place-items-center"
      style={{ color: 'var(--text-dim)' }}
    >
      <svg width="9" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
        <path d="M1 5l4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
