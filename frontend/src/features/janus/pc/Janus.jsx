import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import MapleWindow from '../../../components/pc/MapleWindow'
import Select from '../../../components/common/Select'
import { useJanusDetector } from '../useJanusDetector'
import { usePipWindow } from '../usePipWindow'
import RegionPicker from './RegionPicker'
import RegionPickerModal from './RegionPickerModal'
import MiniBar from './MiniBar'
import {
  loadSettings, saveSettings, durationForLevel, formatSeconds, formatClock,
  LEVEL_TIERS, tierForLevel,
} from '../logic'
import { ensureAudio, scheduleSound, playSound, SOUND_OPTIONS } from '../alarm'

const CARD = { background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }
const SLATE_BAR = {
  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  color: '#ffffff',
  textShadow: '0 1px 1px rgba(44,55,69,.3)',
}

export default function Janus() {
  const [settings, setSettings] = useState(loadSettings)
  const [picking, setPicking] = useState(false)

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
    const fireInSec = ((durationForLevel(s.level) - s.offsetSec) * 1000 - (Date.now() - installedAt)) / 1000
    if (fireInSec > 0) {
      cancelRef.current.push(scheduleSound(s.sound, s.volume, fireInSec))
    }
  }, [clearScheduled])

  const handleInstall = useCallback((next) => {
    scheduleFor(settings, next.at)
  }, [scheduleFor, settings])

  const {
    stream, region, setRegion, install, stale, error,
    videoRef, start, stop, resetCycle, log,
  } = useJanusDetector({ onInstall: handleInstall })

  /* ── 표시값 ─────────────────────────────────────────────── */

  const durationSec = durationForLevel(settings.level)
  const durationMs = durationSec * 1000
  const alarmAtSec = Math.max(0, durationSec - settings.offsetSec)
  const elapsed = install ? Date.now() - install.at : 0
  const active = Boolean(install) && elapsed < durationMs
  const alarmInMs = active ? alarmAtSec * 1000 - elapsed : null
  const progress = active ? elapsed / durationMs : 0

  const pip = usePipWindow()

  const handleStart = async () => {
    ensureAudio() // 사용자 제스처 안에서 오디오를 깨워둔다 (예약이 안 울리는 걸 방지)
    const ok = await start()
    if (ok && !region) setPicking(true)
  }

  const handleTest = () => playSound(settings.sound, settings.volume)

  useEffect(() => () => clearScheduled(), [clearScheduled])

  // 설정을 바꾸면 진행 중인 예약도 새 값으로 다시 잡는다
  useEffect(() => {
    if (active && install) scheduleFor(settings, install.at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.offsetSec, settings.sound, settings.volume, settings.level])

  /* ── 화면 공유 전 ───────────────────────────────────────── */

  if (!stream) {
    return (
      <MapleWindow title="JANUS ALARM" className="max-w-[720px] mx-auto">
        <div className="flex flex-col items-center text-center gap-4 py-8 px-6">
          <div className="text-[42px] leading-none">⏱️</div>
          <div>
            <h2 className="text-[18px] font-extrabold" style={{ color: 'var(--text-strong)' }}>
              야누스 알림
            </h2>
            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              메이플 창을 공유하면 퀵슬롯의 야누스 아이콘을 지켜보다가<br />
              사라지기 전에 소리로 알려줍니다.
            </p>
          </div>

          <ol className="text-left text-[13px] flex flex-col gap-2 my-1" style={{ color: 'var(--text-emphasis)' }}>
            <Step n={1}>아래 버튼을 눌러 <b>메이플스토리 창</b>을 선택합니다</Step>
            <Step n={2}>퀵슬롯의 <b>야누스 아이콘</b>을 드래그해서 지정합니다</Step>
            <Step n={3}>설치하면 자동으로 타이머가 시작됩니다</Step>
          </ol>

          <button
            type="button"
            onClick={handleStart}
            className="rounded-[10px] px-6 py-3 text-[14px] font-extrabold text-white"
            style={{
              background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), 0 3px 8px rgba(0,0,0,.2)',
            }}
          >
            🖥️ 화면 공유 시작
          </button>

          {error && <p className="text-[12.5px]" style={{ color: 'var(--danger-text)' }}>{error}</p>}
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
            공유 화면은 이 브라우저 안에서만 처리되고 어디로도 전송되지 않습니다.<br />
            브라우저 정책상 페이지를 새로 열면 창을 다시 골라야 합니다.
          </p>
        </div>
      </MapleWindow>
    )
  }

  /* ── 감시 중 ────────────────────────────────────────────── */

  return (
    <MapleWindow
      title="JANUS ALARM"
      className="max-w-[900px] mx-auto"
      titleRight={(
        <div className="flex items-center gap-2">
          {stale && <Badge tone="warn">⚠ 화면이 갱신되지 않음</Badge>}
          <Badge tone={active ? 'live' : 'wait'}>{active ? `● 유지 중 · ${install.index}회차` : '● 설치 대기'}</Badge>
        </div>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex gap-3 items-stretch">
          {/* 공유 화면 */}
          <div className="flex-1 min-w-0 rounded-[11px] overflow-hidden relative" style={CARD}>
            <RegionPicker videoRef={videoRef} stream={stream} region={region} />
            <div className="absolute right-2.5 top-2.5 flex gap-1.5">
              <SmallPill tone="slate" onClick={() => setPicking(true)}>영역 지정</SmallPill>
              <SmallPill tone="red" onClick={stop}>공유 중단</SmallPill>
            </div>
            {!region && (
              <div
                className="absolute left-0 right-0 bottom-0 px-3 py-2 text-[12.5px] font-bold"
                style={{ background: 'rgba(10,16,22,.85)', color: '#ffe437' }}
              >
                퀵슬롯의 야누스 아이콘을 지정해 주세요
              </div>
            )}
          </div>

          {/* 타이머 */}
          <div className="w-[212px] shrink-0 rounded-[11px] p-3.5 flex flex-col gap-2.5 justify-center" style={CARD}>
            <div>
              <div className="text-[11.5px] font-extrabold tracking-wide" style={{ color: 'var(--accent-label)' }}>
                다음 알림까지
              </div>
              {alarmInMs != null && alarmInMs > 0 ? (
                <div
                  className="font-extrabold tabular-nums leading-[.95]"
                  style={{ fontSize: 56, letterSpacing: '-2.5px', color: 'var(--text-strong)' }}
                >
                  {formatSeconds(alarmInMs).split('.')[0]}
                  <span style={{ fontSize: 26, letterSpacing: 0 }}>.{formatSeconds(alarmInMs).split('.')[1]}</span>
                </div>
              ) : (
                <div className="font-extrabold tabular-nums leading-[.95]" style={{ fontSize: 56, color: 'var(--text-dim)' }}>
                  --.-
                </div>
              )}
            </div>

            <div
              className="h-2.5 rounded-full relative overflow-hidden"
              style={{ background: 'var(--progress-track)', border: '1px solid var(--input-border)' }}
            >
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                  background: 'linear-gradient(90deg, var(--mpl-sky-from), var(--mpl-sky-to))',
                }}
              />
              {alarmAtSec > 0 && (
                <span
                  className="absolute -top-1 w-0.5 h-[18px]"
                  style={{ left: `${(alarmAtSec / durationSec) * 100}%`, background: 'var(--warning-text)' }}
                />
              )}
            </div>

            <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
              {install
                ? <>설치 <b style={{ color: 'var(--text-muted)' }}>{formatClock(install.at)}</b></>
                : '야누스를 설치하면 시작합니다'}
            </div>

            <div className="flex gap-1.5">
              {pip.supported && (
                <SmallPill tone="sky" className="flex-1" onClick={() => (pip.pip ? pip.close() : pip.open())}>
                  {pip.pip ? '미니 HUD 닫기' : '미니 HUD 열기'}
                </SmallPill>
              )}
              <SmallPill tone="slate" onClick={resetCycle}>↺</SmallPill>
            </div>
          </div>
        </div>

        {/* 설정 */}
        <div className="rounded-[11px] overflow-hidden" style={CARD}>
          <div className="px-3.5 py-2 text-[12.5px] font-extrabold" style={SLATE_BAR}>⚙️ 설정</div>

          <SettingRow name="스킬 레벨" desc="레벨로 지속시간이 정해집니다">
            <Select
              showSub
              options={LEVEL_TIERS}
              value={tierForLevel(settings.level)}
              onChange={(v) => set({ level: v })}
            />
          </SettingRow>

          <SettingRow
            name="알림 시점"
            desc={<>젠 주기 × 젠 수로 잡으세요 — 지금 설정이면 <b style={{ color: 'var(--text-muted)' }}>설치 후 {alarmAtSec}초</b>에 알립니다</>}
          >
            <div
              className="flex items-center gap-2 rounded-[9px] px-3 py-2"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
            >
              <input
                type="number" min={1} max={Math.max(1, durationSec - 1)}
                value={settings.offsetSec}
                onChange={(e) => set({ offsetSec: Math.max(1, Number(e.target.value) || 1) })}
                className="janus-num flex-1 min-w-0 text-[13.5px] font-semibold tabular-nums bg-transparent outline-none"
                style={{ color: 'var(--text-strong)' }}
              />
              <span className="text-[12.5px] font-bold shrink-0" style={{ color: 'var(--text-dim)' }}>초 전</span>
            </div>
          </SettingRow>

          <SettingRow name="알림 소리" desc="백그라운드 탭에서도 정확한 시각에 울립니다">
            <div className="flex gap-2 items-center">
              <div className="flex-1 min-w-0">
                <Select options={SOUND_OPTIONS} value={settings.sound} onChange={(v) => set({ sound: v })} />
              </div>
              <SmallPill tone="tan" className="shrink-0 !px-2.5" onClick={handleTest}>🔔</SmallPill>
            </div>
          </SettingRow>

          <SettingRow name="소리 크기" desc="테스트 버튼으로 들어보면서 맞추세요">
            <div className="flex items-center gap-2.5">
              <input
                type="range" min={0} max={100} value={Math.round(settings.volume * 100)}
                onChange={(e) => set({ volume: Number(e.target.value) / 100 })}
                className="janus-range flex-1 min-w-0"
              />
              <span className="text-[12.5px] font-bold tabular-nums w-[34px] text-right" style={{ color: 'var(--text-muted)' }}>
                {Math.round(settings.volume * 100)}%
              </span>
            </div>
          </SettingRow>
        </div>
      </div>

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
            remainingMs={alarmInMs}
            progress={progress}
            cycleIndex={install?.index ?? 0}
            onTest={handleTest}
            onReset={resetCycle}
            compact
          />
        </div>,
        pip.pip.document.body
      )}
    </MapleWindow>
  )
}

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

const TONES = {
  tan: 'linear-gradient(180deg, var(--mpl-tan-from), var(--mpl-tan-to))',
  slate: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  sky: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
  red: 'linear-gradient(180deg, var(--mpl-red-from), var(--mpl-red-to))',
}

function SmallPill({ tone, onClick, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[12.5px] font-extrabold text-white ${className}`}
      style={{
        background: TONES[tone],
        textShadow: '0 1px 0 rgba(0,0,0,.28)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.3), 0 2px 5px rgba(0,0,0,.2)',
      }}
    >
      {children}
    </button>
  )
}

/** 설정 한 줄 — 이름 / 설명 / 컨트롤 */
function SettingRow({ name, desc, children }) {
  return (
    <div className="flex items-center gap-3.5 px-3.5 py-2.5" style={{ borderTop: '1px solid var(--mpl-card-line)' }}>
      <span className="w-[92px] shrink-0 text-[13px] font-bold" style={{ color: 'var(--text-emphasis)' }}>{name}</span>
      <span className="flex-1 min-w-0 text-[12.5px]" style={{ color: 'var(--text-dim)' }}>{desc}</span>
      <span className="w-[196px] shrink-0">{children}</span>
    </div>
  )
}
