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
  DETECT, LOCATE, loadSettings, saveSettings, durationForLevel, formatSeconds,
  LEVEL_TIERS, tierForLevel,
} from '../logic'
import { ensureAudio, scheduleSound, playSound, preloadSounds, resolveSound, SOUND_OPTIONS } from '../alarm'

const CARD = { background: 'var(--mpl-card)', border: '1px solid var(--mpl-card-line)' }
const SLATE_BAR = {
  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  color: '#ffffff',
  textShadow: '0 1px 1px rgba(44,55,69,.3)',
}

export default function Janus() {
  const [settings, setSettings] = useState(loadSettings)
  const [picking, setPicking] = useState(false)
  const [candidates, setCandidates] = useState(null)
  const [locating, setLocating] = useState(false)

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
    stream, region, setRegion, install, stale, error, match, glyphs, iconLost,
    videoRef, start, stop, resetCycle, locate, hasTemplate, log,
  } = useJanusDetector({ onInstall: handleInstall })

  /* ── 표시값 ─────────────────────────────────────────────── */

  const soundValue = resolveSound(settings.sound)
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
    preloadSounds() // 음원을 미리 받아둔다 — 알림 시각에 네트워크를 기다리지 않도록
    const ok = await start()
    if (!ok || region) return

    // 전에 지정한 적이 있으면 화면에서 아이콘을 자동으로 찾아본다
    if (!hasTemplate) { setPicking(true); return }
    setLocating(true)
    // 영상이 실제로 흐르기 시작할 때까지 잠깐 기다린다
    await new Promise((r) => setTimeout(r, 700))
    applyHits(locate())
  }

  /**
   * 확실한 것이 딱 하나면 바로 쓰고, 애매하면 고르게 한다.
   * 실제 게임 아이콘은 단축키 글자와 슬롯 테두리가 겹쳐 점수가 깎이므로
   * 통과선을 못 넘었다고 곧장 수동으로 보내지 않는다.
   */
  const applyHits = (hits) => {
    setLocating(false)
    if (!hits || hits.length === 0) { setPicking(true); return }
    const [best, second] = hits
    const clear = best.score >= LOCATE.sureScore
      && (!second || best.score - second.score >= LOCATE.sureMargin)
    if (clear) setRegion(best.region)
    else setCandidates(hits.slice(0, 6))
  }

  const relocate = async () => {
    setLocating(true)
    await new Promise((r) => setTimeout(r, 50))
    applyHits(locate())
  }

  const handleTest = async () => {
    // 아직 못 받았을 수 있다 — 받아두고 눌러야 소리가 난다
    await preloadSounds()
    playSound(soundValue, settings.volume)
  }

  useEffect(() => () => clearScheduled(), [clearScheduled])

  // 설정을 바꾸면 진행 중인 예약도 새 값으로 다시 잡는다
  useEffect(() => {
    if (active && install) scheduleFor(settings, install.at)
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
          <Badge tone={active ? 'live' : 'wait'}>{active ? `● 유지 중 · ${install.index}회차` : '● 설치 대기'}</Badge>
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
                <div className="text-[13px] font-extrabold tracking-wide" style={{ color: 'var(--mpl-title-yellow)' }}>
                  다음 알림까지
                </div>
                {alarmInMs != null && alarmInMs > 0 ? (
                  <div
                    className="font-extrabold tabular-nums leading-[.95]"
                    style={{ fontSize: 64, letterSpacing: '-2.5px', color: '#eef3f8' }}
                  >
                    {formatSeconds(alarmInMs).split('.')[0]}
                    <span style={{ fontSize: 30, letterSpacing: 0 }}>.{formatSeconds(alarmInMs).split('.')[1]}</span>
                  </div>
                ) : (
                  <div className="font-extrabold leading-[1.3]" style={{ fontSize: 38, color: '#8ba0b4' }}>
                    지속시간 종료
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
              <Select options={SOUND_OPTIONS} value={soundValue} onChange={(v) => set({ sound: v })} />
            </div>
            <IconButton tone="tan" label="소리 테스트" size={34} onClick={handleTest}><BellIcon /></IconButton>
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

        {match != null && (
          <SettingRow
            name="아이콘 인식"
            desc="왼쪽은 지정한 모양과의 일치도, 오른쪽은 쿨타임 숫자로 보이는 밝은 점의 비율입니다"
          >
            <div className="flex items-center gap-3 text-[13.5px] font-extrabold tabular-nums">
              <span style={{ color: match >= DETECT.matchThreshold ? 'var(--ok-text)' : 'var(--warning-text)' }}>
                {Math.round(match * 100)}%
              </span>
              <span style={{ color: 'var(--text-dim)' }}>·</span>
              <span style={{ color: (glyphs ?? 0) >= DETECT.glyphMinRatio ? 'var(--accent-label)' : 'var(--text-dim)' }}>
                숫자 {Math.round((glyphs ?? 0) * 100)}%
              </span>
            </div>
          </SettingRow>
        )}
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
            remainingMs={alarmInMs}
            progress={progress}
            cycleIndex={install?.index ?? 0}
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
    <div className="flex items-center gap-3.5 px-3.5 py-2.5" style={{ borderTop: '1px solid var(--mpl-card-line)' }}>
      <span className="w-[92px] shrink-0 text-[13px] font-bold" style={{ color: 'var(--text-emphasis)' }}>{name}</span>
      <span className="flex-1 min-w-0 text-[12.5px]" style={{ color: 'var(--text-dim)' }}>{desc}</span>
      <span className="w-[196px] shrink-0">{children}</span>
    </div>
  )
}
