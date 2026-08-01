import { formatSeconds } from '../logic'

/**
 * HUD 미니바 — 페이지 안에서도 쓰고, PiP 창으로 분리해도 같은 걸 쓴다.
 * 배경은 게임창 몸체색이 아니라 카드색(라이트에서 흰색) — 작은 바에서 회청색은 답답해서.
 */
export default function MiniBar({
  active, remainingMs, alarmInMs, progress,
  cycleIndex, onTest, onReset, onSettings, compact = false,
}) {

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(31,44,61,.4)', boxShadow: '0 10px 30px rgba(31,44,61,.25)' }}
    >
      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ background: 'linear-gradient(180deg, var(--mpl-navy-from), var(--mpl-navy-to))' }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: '#5a7188' }} />
        <span
          className="text-[13px] font-bold"
          style={{ color: 'var(--mpl-title-yellow)', textShadow: '0 1px 0 rgba(0,0,0,.5)' }}
        >
          야누스
        </span>
        <span className="flex-1" />
        <span
          className="text-[11px] font-extrabold px-1.5 py-0.5 rounded border"
          style={active
            ? { color: '#b6e77c', background: 'rgba(159,212,94,.16)', borderColor: 'rgba(159,212,94,.42)' }
            : { color: '#cfdae4', background: 'rgba(207,218,228,.12)', borderColor: 'rgba(207,218,228,.3)' }}
        >
          {active ? `● 사이클 ${cycleIndex}` : '설치 대기'}
        </span>
      </div>

      <div className="px-3.5 py-3 flex flex-col gap-2.5" style={{ background: 'var(--mpl-card)' }}>
        <div className="flex items-end gap-3">
          {remainingMs == null ? (
            <div className="font-extrabold leading-[.9] tabular-nums" style={{ fontSize: compact ? 38 : 46, color: 'var(--text-dim)' }}>--.-</div>
          ) : (
            <div
              className="font-extrabold tabular-nums leading-[.9] tracking-tighter"
              style={{ fontSize: compact ? 46 : 56, color: 'var(--text-strong)' }}
            >
              {formatSeconds(remainingMs).split('.')[0]}
              <span className="tracking-normal" style={{ fontSize: compact ? 22 : 26 }}>
                .{formatSeconds(remainingMs).split('.')[1]}
              </span>
            </div>
          )}
          <div className="pb-1.5">
            <div className="text-[11.5px] font-extrabold tracking-wide" style={{ color: 'var(--accent-label)' }}>
              {remainingMs == null ? '설치 대기 중' : '사라지기까지'}
            </div>
            <div className="text-[12px] font-bold mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {alarmInMs != null && alarmInMs > 0
                ? <>알림 <b className="tabular-nums" style={{ color: 'var(--warning-text)' }}>{formatSeconds(alarmInMs)}초</b> 뒤</>
                : '아이콘이 어두워지면 시작합니다'}
            </div>
          </div>
        </div>

        <div
          className="h-3 rounded-full relative overflow-hidden"
          style={{ background: 'var(--progress-track)', border: '1px solid var(--input-border)' }}
        >
          <div
            className="h-full transition-[width] duration-100 ease-linear"
            style={{
              width: `${Math.min(100, Math.max(0, progress * 100))}%`,
              background: 'linear-gradient(90deg, var(--mpl-sky-from), var(--mpl-sky-to))',
            }}
          />
        </div>

        <div className="flex gap-1.5">
          <MiniButton onClick={onTest} tone="tan">🔔 테스트</MiniButton>
          <MiniButton onClick={onReset} tone="slate">↺ 리셋</MiniButton>
          {onSettings && <MiniButton onClick={onSettings} tone="sky">⚙ 설정</MiniButton>}
        </div>
      </div>
    </div>
  )
}

const TONES = {
  tan: 'linear-gradient(180deg, var(--mpl-tan-from), var(--mpl-tan-to))',
  slate: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
  sky: 'linear-gradient(180deg, var(--mpl-sky-from), var(--mpl-sky-to))',
}

function MiniButton({ tone, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-extrabold text-white"
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
