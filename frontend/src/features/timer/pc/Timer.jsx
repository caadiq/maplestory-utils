import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import MapleWindow from '../../../components/pc/MapleWindow'
import Select from '../../../components/common/Select'
import { RefreshIcon, PipIcon, CropIcon, StopIcon, BellIcon, IconButton } from './icons'
import { useJanusDetector } from '../useJanusDetector'
import { usePipWindow } from '../usePipWindow'
import RegionPicker from './RegionPicker'
import RegionPickerModal from './RegionPickerModal'
import CandidatePicker from './CandidatePicker'
import MiniBar from './MiniBar'
import {
  DETECT, loadSettings, saveSettings, durationForSettings, formatSeconds,
  LEVEL_TIERS, tierForLevel, ALARM_DISPLAY_BIAS_MS, DURATION_LAG_MS, MODE_LABELS,
} from '../logic'
import { LOCATE } from '../locateCore'
import { ensureAudio, scheduleSound, playSound, preloadSounds, resolveSound, SOUND_OPTIONS } from '../alarm'

/* 모드 드롭다운 — 라벨 앞에 실제 스킬 아이콘을 붙인다 */
const MODE_ICONS = import.meta.glob('../icon/janus-*.png', { eager: true, query: '?url', import: 'default' })
const modeIcon = (m) => Object.entries(MODE_ICONS).find(([p]) => p.includes(`janus-${m}`))?.[1]
const MODE_OPTIONS = Object.entries(MODE_LABELS).map(([value, label]) => ({
  value, label, subIcon: modeIcon(value),
}))

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
  const [candidates, setCandidates] = useState(null)
  const [locating, setLocating] = useState(false)

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
    const fireInSec = ((durationForSettings(s) - s.offsetSec) * 1000
      - DURATION_LAG_MS + ALARM_DISPLAY_BIAS_MS - (Date.now() - installedAt)) / 1000
    if (fireInSec > 0) {
      cancelRef.current.push(scheduleSound(s.sound, s.volume, fireInSec))
    }
  }, [clearScheduled])

  const handleInstall = useCallback((next) => {
    scheduleFor(settings, next.at)
  }, [scheduleFor, settings])

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
    mode: settings.mode,
    cycleMs,
  })

  /* ── 표시값 ─────────────────────────────────────────────── */

  const soundValue = resolveSound(settings.sound)
  const installedAt = install ? install.at : 0
  const elapsed = install ? Date.now() - installedAt : 0
  const active = Boolean(install) && elapsed < cycleMs
  // 표시도 실제 울리는 시각과 같아야 한다
  const alarmInMs = active
    ? alarmAtSec * 1000 - DURATION_LAG_MS + ALARM_DISPLAY_BIAS_MS - elapsed
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
    applyHits(await locate())
  }

  /**
   * 확실한 것이 딱 하나면 바로 쓰고, 애매하면 고르게 한다.
   * 실제 게임 아이콘은 단축키 글자와 슬롯 테두리가 겹쳐 점수가 깎이므로
   * 통과선을 못 넘었다고 곧장 수동으로 보내지 않는다.
   */
  const applyHits = (found) => {
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
    if (!hits?.length) { setPicking(true); return }
    const [best, second] = hits
    const minScore = found.learned ? LOCATE.sureScore : LOCATE.builtinSureScore
    const minMargin = found.learned ? LOCATE.sureMargin : LOCATE.builtinSureMargin
    const clear = best.score >= minScore
      && (!second || best.score - second.score >= minMargin)
    if (clear) setRegion(best.region)
    else setCandidates(hits.slice(0, 6))
  }

  const relocate = async () => {
    setLocating(true)
    await new Promise((r) => setTimeout(r, 50))
    applyHits(await locate())
  }

  const handleTest = async () => {
    // 아직 못 받았을 수 있다 — 받아두고 눌러야 소리가 난다
    await preloadSounds()
    playSound(soundValue, settings.volume)
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

  // 설정을 바꾸면 진행 중인 예약도 새 값으로 다시 잡는다
  useEffect(() => {
    if (active && install) scheduleFor(settings, installedAt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.offsetSec, settings.sound, settings.volume, settings.level])

  /* ── 감시 중 ────────────────────────────────────────────── */

  return (
    <MapleWindow
      title="JANUS ALARM"
      className="max-w-[900px] mx-auto"
      titleRight={(
        <div className="flex items-center gap-2">
          {stale && <Badge tone="warn">⚠ 화면이 갱신되지 않음</Badge>}
          <Badge tone={active ? 'live' : 'wait'}>{active
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
              <IconButton tone="slate" label="초기화" onClick={resetCycle}><RefreshIcon /></IconButton>
              {pip.supported && (
                <IconButton
                  tone="sky"
                  label={pip.pip ? '미니 HUD 닫기' : '미니 HUD 열기'}
                  onClick={() => (pip.pip ? pip.close() : pip.open())}
                >
                  <PipIcon />
                </IconButton>
              )}
              <IconButton tone="slate" label="아이콘 다시 찾기" onClick={relocate}><CropIcon /></IconButton>
              <IconButton tone="red" label="화면 공유 중단" onClick={stop}><StopIcon /></IconButton>
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

        {stream && !region && (
          <div
            className="absolute left-0 right-0 top-0 px-3 py-2 text-[12.5px] font-bold"
            style={{ background: 'rgba(10,16,22,.85)', color: '#ffe437' }}
          >
            퀵슬롯의 야누스 아이콘을 지정해 주세요
          </div>
        )}

        {stream && region && (stale || iconLost) && (
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

      {/* 설정 */}
      <div className="rounded-[11px] overflow-hidden" style={CARD}>
        <div className="px-4 py-2.5 text-[13.5px] font-extrabold" style={SLATE_BAR}>⚙️ 설정</div>

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
            ? <>아이템이 사라지기 <b style={{ color: 'var(--text-muted)' }}>{settings.offsetSec}초</b> 전에 알립니다 — 회수할 시간을 감안해 잡으세요</>
            : <>지속시간이 <b style={{ color: 'var(--text-muted)' }}>{settings.offsetSec}초</b> 남았을 때 알립니다 — 젠 주기 × 젠 수로 잡으세요</>}
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
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-2">
              <div className="w-[126px]">
                <Select options={SOUND_OPTIONS} value={soundValue} onChange={(v) => set({ sound: v })} />
              </div>
              <IconButton tone="tan" label="소리 테스트" size={36} onClick={handleTest}><BellIcon /></IconButton>
            </div>
            <div className="flex items-center gap-2.5">
              <input
                type="range" min={0} max={100} value={Math.round(settings.volume * 100)}
                onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
                className="janus-range w-[130px]"
                aria-label="소리 크기"
              />
              <span className="text-[13px] font-bold tabular-nums w-[38px] text-right" style={{ color: 'var(--text-muted)' }}>
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
          </div>
        </SettingRow>
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


/** 설정 한 줄 — 이름 / 설명 / 컨트롤 */
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
