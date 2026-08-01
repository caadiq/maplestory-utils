import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import MapleWindow from '../../../components/pc/MapleWindow'
import { useJanusDetector } from '../useJanusDetector'
import { usePipWindow } from '../usePipWindow'
import RegionPicker from './RegionPicker'
import RegionPickerModal from './RegionPickerModal'
import MiniBar from './MiniBar'
import {
  DETECT, loadSettings, saveSettings, durationForLevel, formatSeconds, formatClock, formatLogTime,
  SOUND_OPTIONS,
} from '../logic'
import {
  ensureAudio, scheduleSound, playSound, blinkTitle, stopBlink, notify, requestNotifyPermission,
} from '../alarm'

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
    stopBlink()
  }, [])

  /**
   * installedAt은 "아이콘이 어두워진 순간"이고 확정은 그보다 조금 뒤에 일어나므로,
   * 예약 시각은 지금이 아니라 설치 시각을 기준으로 잡는다.
   */
  const scheduleFor = useCallback((settingsNow, installedAt) => {
    clearScheduled()
    const durationMs = (durationForLevel(settingsNow.level) || 0) * 1000
    const elapsed = Date.now() - installedAt

    const fireInSec = (durationMs - settingsNow.offsetSec * 1000 - elapsed) / 1000
    if (fireInSec > 0) {
      cancelRef.current.push(scheduleSound(settingsNow.sound, settingsNow.volume, fireInSec))
      const t = setTimeout(() => {
        if (settingsNow.titleBlink) blinkTitle('🔔 야누스 재설치')
        if (settingsNow.browserNotify) {
          notify('야누스', `${settingsNow.offsetSec}초 뒤 사라집니다 — 다시 설치하세요`)
        }
      }, fireInSec * 1000)
      cancelRef.current.push(() => clearTimeout(t))
    }

    const endInSec = (durationMs - elapsed) / 1000
    if (settingsNow.notifyDurationEnd && endInSec > 0) {
      cancelRef.current.push(scheduleSound('beep', settingsNow.volume * 0.7, endInSec))
    }
  }, [clearScheduled])

  const handleInstall = useCallback((next) => {
    scheduleFor(settings, next.at)
  }, [scheduleFor, settings])

  const detector = useJanusDetector({ onInstall: handleInstall })
  const {
    stream, region, setRegion, install, iconDark, logs, stale, error, level,
    videoRef, start, stop, resetCycle, markInstalledNow, log,
  } = detector

  /* ── 표시값 ─────────────────────────────────────────────── */

  const durationMs = (durationForLevel(settings.level) || 0) * 1000
  const now = Date.now()
  const elapsed = install ? now - install.at : 0
  const active = Boolean(install) && elapsed < durationMs
  const remainingMs = active ? durationMs - elapsed : null
  const alarmInMs = remainingMs != null ? remainingMs - settings.offsetSec * 1000 : null
  const progress = active ? elapsed / durationMs : 0

  /* ── PiP ────────────────────────────────────────────────── */

  const pip = usePipWindow()

  const handleStart = async () => {
    ensureAudio() // 사용자 제스처 안에서 오디오를 깨워둔다 (나중에 예약이 안 울리는 걸 방지)
    const ok = await start()
    if (ok && !region) setPicking(true)
  }

  const handleTest = () => playSound(settings.sound, settings.volume)

  useEffect(() => () => clearScheduled(), [clearScheduled])

  // 설정을 바꾸면 진행 중인 예약도 새 값으로 다시 잡는다
  useEffect(() => {
    if (active && install) scheduleFor(settings, install.at)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.offsetSec, settings.sound, settings.volume, settings.level, settings.notifyDurationEnd])

  const miniProps = {
    active, remainingMs, alarmInMs, progress,
    cycleIndex: install?.index ?? 0,
    onTest: handleTest,
    onReset: resetCycle,
  }

  /* ── 화면 공유 전 ───────────────────────────────────────── */

  if (!stream) {
    return (
      <MapleWindow title="JANUS ALARM" className="max-w-[760px] mx-auto">
        <div className="flex flex-col items-center text-center gap-4 py-8 px-6">
          <div className="text-[42px] leading-none">⏱️</div>
          <div>
            <h2 className="text-[18px] font-extrabold" style={{ color: 'var(--text-strong)' }}>
              야누스 쿨타임 알림
            </h2>
            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              메이플 창을 공유하면 퀵슬롯의 야누스 아이콘을 지켜보다가<br />
              쿨타임이 끝나기 직전에 소리로 알려줍니다.
            </p>
          </div>

          <ol className="text-left text-[13px] flex flex-col gap-2 my-1" style={{ color: 'var(--text-emphasis)' }}>
            <Step n={1}>아래 버튼을 눌러 <b>메이플스토리 창</b>을 선택합니다</Step>
            <Step n={2}>퀵슬롯의 <b>야누스 아이콘</b>을 드래그해서 지정합니다</Step>
            <Step n={3}>야누스를 설치하면 자동으로 쿨타임을 재기 시작합니다</Step>
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

          {error && (
            <p className="text-[12.5px]" style={{ color: 'var(--danger-text)' }}>{error}</p>
          )}
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
      titleRight={(
        <div className="flex items-center gap-2">
          {stale && <Badge tone="warn">⚠ 화면이 갱신되지 않음</Badge>}
          <Badge tone={active ? 'live' : 'wait'}>{active ? `● 유지 중 · 사이클 ${install.index}` : '● 설치 대기'}</Badge>
        </div>
      )}
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex gap-3.5 items-start">
         <div className="flex-1 min-w-0 flex flex-col gap-3.5">
          {/* 타이머 */}
          <div className="rounded-[11px] p-3.5 flex flex-col gap-3" style={CARD}>
            <div className="flex items-end gap-3.5">
              {remainingMs == null ? (
                <div className="font-extrabold leading-[.9] tabular-nums" style={{ fontSize: 56, color: 'var(--text-dim)' }}>--.-</div>
              ) : (
                <div
                  className="font-extrabold tabular-nums leading-[.9]"
                  style={{ fontSize: 68, letterSpacing: '-3.5px', color: 'var(--text-strong)' }}
                >
                  {formatSeconds(remainingMs).split('.')[0]}
                  <span style={{ fontSize: 30, letterSpacing: 0 }}>.{formatSeconds(remainingMs).split('.')[1]}</span>
                </div>
              )}
              <div className="pb-1.5 flex-1">
                <div className="text-[12px] font-extrabold tracking-wide" style={{ color: 'var(--accent-label)' }}>
                  {remainingMs == null
                    ? (install ? '지속시간 종료 — 다시 설치하면 이어서 잽니다' : '설치 대기 중')
                    : `사라지기까지 · 총 ${durationForLevel(settings.level)}초`}
                </div>
                <div className="text-[13px] font-bold mt-1" style={{ color: 'var(--text-muted)' }}>
                  {install
                    ? <>사이클 #{install.index} · 설치 <b className="tabular-nums" style={{ color: 'var(--text-emphasis)' }}>{formatClock(install.at)}</b></>
                    : '야누스를 설치하면 시작합니다'}
                </div>
              </div>
              <div className="flex gap-1.5 pb-1.5">
                {pip.supported && (
                  <SmallPill tone="sky" onClick={() => (pip.pip ? pip.close() : pip.open())}>
                    {pip.pip ? '창 닫기' : '작은 창으로'}
                  </SmallPill>
                )}
                <SmallPill tone="lime" onClick={markInstalledNow}>지금 설치함</SmallPill>
                <SmallPill tone="tan" onClick={handleTest}>🔔</SmallPill>
                <SmallPill tone="slate" onClick={resetCycle}>↺ 리셋</SmallPill>
              </div>
            </div>

            <div
              className="h-3 rounded-full overflow-hidden relative"
              style={{ background: 'var(--progress-track)', border: '1px solid var(--input-border)' }}
            >
              <div
                className="h-full"
                style={{
                  width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                  background: 'linear-gradient(90deg, var(--mpl-sky-from), var(--mpl-sky-to))',
                }}
              />
              {settings.offsetSec * 1000 < durationMs && (
                <span
                  className="absolute -top-1 w-0.5 h-5"
                  style={{
                    left: `${((durationMs - settings.offsetSec * 1000) / durationMs) * 100}%`,
                    background: 'var(--warning-text)',
                  }}
                />
              )}
            </div>

            <div className="flex gap-3.5">
              <Stat label="알림까지" value={alarmInMs != null && alarmInMs > 0 ? `${formatSeconds(alarmInMs)}초` : '-'} color="var(--warning-text)" />
              <Stat label="알림 시점" value={`설치 후 ${Math.max(0, durationForLevel(settings.level) - settings.offsetSec)}초`} />
              <Stat label="설치 횟수" value={`${install?.index ?? 0}회`} />
              <Stat label="아이콘" value={iconDark ? '쿨타임 중' : '사용 가능'} color={iconDark ? 'var(--text-muted)' : 'var(--ok-text)'} />
            </div>
          </div>


          {/* 알림 설정 */}
          <div className="rounded-[11px] overflow-hidden" style={CARD}>
            <div className="px-3.5 py-2 text-[12.5px] font-extrabold" style={SLATE_BAR}>⚙️ 알림 설정</div>
            <div className="p-3.5 flex gap-3.5 items-start">
              <Field label="야누스 스킬 레벨" width={170}>
                <div className="flex gap-2 items-center">
                  <input
                    type="number" min={1} max={30} value={settings.level}
                    onChange={(e) => set({ level: Number(e.target.value) })}
                    className="rounded-lg px-2.5 py-2 text-[13.5px] font-semibold tabular-nums w-[74px]"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-strong)' }}
                  />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                    지속 <b style={{ color: 'var(--text-emphasis)' }}>{durationForLevel(settings.level)}초</b>
                  </span>
                </div>
              </Field>

              <Field label="알림 시점 (사라지기 전)" width={280}>
                <div className="flex gap-2 items-center">
                  <input
                    type="number" min={1} max={Math.max(1, durationForLevel(settings.level) - 1)}
                    value={settings.offsetSec}
                    onChange={(e) => set({ offsetSec: Math.max(1, Number(e.target.value) || 1) })}
                    className="rounded-lg px-2.5 py-2 text-[13.5px] font-semibold tabular-nums w-[74px]"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-strong)' }}
                  />
                  <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                    초 전<br />젠 주기 × 젠 수로 잡으면 됩니다
                  </span>
                </div>
              </Field>

              <Field label="소리" width={175}>
                <Seg options={SOUND_OPTIONS} value={settings.sound} onChange={(v) => set({ sound: v })} />
              </Field>

              <Field label="추가 알림" grow>
                <div className="flex flex-col gap-1.5 pt-0.5">
                  <Check
                    checked={settings.titleBlink}
                    onChange={(v) => set({ titleBlink: v })}
                  >탭 제목 깜빡임</Check>
                  <Check
                    checked={settings.browserNotify}
                    onChange={async (v) => set({ browserNotify: v && await requestNotifyPermission() })}
                  >브라우저 알림</Check>
                  <Check
                    checked={settings.notifyDurationEnd}
                    onChange={(v) => set({ notifyDurationEnd: v })}
                  >사라질 때도 알림</Check>
                </div>
              </Field>

            </div>
          </div>
         </div>

            {/* 인식 영역 */}
            <div className="w-[352px] rounded-[11px] overflow-hidden flex flex-col" style={CARD}>
              <div className="px-3.5 py-2 text-[12.5px] font-extrabold" style={SLATE_BAR}>🖥️ 인식 영역</div>
              <div className="p-3.5 flex flex-col gap-2.5">
                <RegionPicker videoRef={videoRef} stream={stream} region={region} />
                {!region ? (
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--warning-text)' }}>
                    아직 영역이 지정되지 않았습니다. 퀵슬롯의 야누스 아이콘을 드래그해 주세요.
                  </p>
                ) : stale ? (
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--warning-text)' }}>
                    ⚠️ 화면이 갱신되지 않고 있습니다. 게임 창이 최소화됐거나 가려졌는지 확인해 주세요.
                  </p>
                ) : (
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                    아이콘이 어두워지는 순간만 설치로 봅니다. 그 뒤로는 레벨로 정해진 지속시간을 타이머로 세기 때문에, 쿨타임 막바지에 아이콘이 깜빡여도 영향을 받지 않아요.
                  </p>
                )}

                {/* 지금 밝기가 임계선의 어디쯤인지 — 오검출이 날 때 원인을 눈으로 볼 수 있게 */}
                {region && level && <LevelMeter luma={level.luma} base={level.base} />}
                <div className="flex gap-1.5">
                  <SmallPill tone="sky" className="flex-1" onClick={() => setPicking(true)}>영역 다시 지정</SmallPill>
                  <SmallPill tone="red" onClick={stop}>공유 중단</SmallPill>
                </div>
              </div>
            </div>
        </div>

        {/* 인식 기록 */}
        <div className="rounded-[11px] overflow-hidden" style={CARD}>
          <div className="px-3.5 py-2 text-[12.5px] font-extrabold flex items-center" style={SLATE_BAR}>
            📋 인식 기록
            <span className="flex-1" />
            <span style={{ color: '#cfdae4' }}>
              {install ? `설치 ${install.index}회` : '설치를 기다리는 중'}
            </span>
          </div>
          {logs.length === 0 ? (
            <div className="px-3.5 py-5 text-center text-[12.5px]" style={{ color: 'var(--text-dim)' }}>
              야누스를 설치하면 기록이 쌓입니다
            </div>
          ) : (
            <div className="text-[12.5px]">
              {logs.map((l, i) => (
                <div
                  key={`${l.at}-${i}`}
                  className="flex gap-2.5 items-center px-3.5 py-2"
                  style={i ? { borderTop: '1px solid var(--mpl-card-line)' } : undefined}
                >
                  <span className="w-[52px] tabular-nums" style={{ color: 'var(--text-dim)' }}>{formatLogTime(l.at)}</span>
                  <span className="flex-1" style={{ color: 'var(--text-emphasis)' }}>{l.message}</span>
                  {l.tag && (
                    <span
                      className="font-bold"
                      style={{ color: l.tagColor === 'ok' ? 'var(--ok-text)' : l.tagColor === 'warn' ? 'var(--warning-text)' : 'var(--text-muted)' }}
                    >
                      {l.tag}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
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
          <MiniBar {...miniProps} compact />
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
  lime: 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))',
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

/**
 * 밝기 진단 막대. 현재 밝기가 기준선 대비 몇 %인지와 어두움 판정선을 같이 보여준다.
 * 오검출 신고가 들어왔을 때 "임계선을 스쳤는지"를 눈으로 확인할 수 있어야 해서 넣었다.
 */
function LevelMeter({ luma, base }) {
  const ratio = base ? luma / base : 0
  const pct = Math.min(100, Math.max(0, ratio * 100))
  const dark = ratio < DETECT.darkRatio
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11.5px] font-bold shrink-0" style={{ color: 'var(--text-dim)' }}>밝기</span>
      <div className="flex-1 h-2 rounded-full relative overflow-hidden" style={{ background: 'var(--progress-track)' }}>
        <div className="h-full" style={{ width: `${pct}%`, background: dark ? 'var(--warning-text)' : 'var(--mpl-sky-to)' }} />
        <span
          className="absolute top-0 bottom-0 w-px"
          style={{ left: `${DETECT.darkRatio * 100}%`, background: 'var(--danger-text)' }}
        />
      </div>
      <span
        className="text-[11.5px] font-bold tabular-nums shrink-0"
        style={{ color: dark ? 'var(--warning-text)' : 'var(--text-muted)' }}
      >
        {Math.round(ratio * 100)}%
      </span>
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div className="flex-1 rounded-[9px] px-3 py-2.5" style={{ background: 'var(--mpl-row)', border: '1px solid var(--mpl-card-line)' }}>
      <div className="text-[12px] font-bold" style={{ color: 'var(--text-muted)' }}>{label}</div>
      <div className="text-[19px] font-extrabold mt-0.5 tabular-nums" style={{ color: color || 'var(--text-strong)' }}>{value}</div>
    </div>
  )
}

function Field({ label, width, grow, children }) {
  return (
    <div style={grow ? { flex: 1 } : { width }}>
      <span className="block text-[12.5px] font-bold mb-1.5" style={{ color: 'var(--text-muted)' }}>{label}</span>
      {children}
    </div>
  )
}

function Seg({ options, value, onChange }) {
  return (
    <div
      className="flex rounded-[9px] p-[3px] gap-[3px]"
      style={{ background: 'var(--surface-2)', border: '1px solid var(--input-border)' }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className="flex-1 rounded-md py-1.5 text-[13px] font-bold"
            style={active
              ? { background: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))', color: '#fff', textShadow: '0 1px 0 rgba(0,0,0,.25)' }
              : { color: 'var(--text-muted)' }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Check({ checked, onChange, children }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-[13px] font-semibold text-left whitespace-nowrap"
      style={{ color: 'var(--text-emphasis)' }}
    >
      <span
        className="w-[17px] h-[17px] rounded-[5px] grid place-items-center text-[11px] text-white shrink-0"
        style={checked
          ? { background: 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))' }
          : { background: 'var(--surface-2)', border: '1px solid var(--input-border)' }}
      >
        {checked ? '✓' : ''}
      </span>
      {children}
    </button>
  )
}
