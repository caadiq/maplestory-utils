import { formatSeconds } from '../logic'
import { TimerResetIcon, IconButton } from './icons'

/**
 * 미니 HUD — PiP 창으로 분리해 게임 위에 띄우는 타이머.
 * 본 화면의 오버레이 패널과 같은 모양으로 맞춰 둘 사이에 낯섦이 없게 한다.
 */
export default function MiniBar({ active, remainingMs, progress, cycleIndex, sync, onReset, idleLabel = '설치 대기' }) {
  return (
    <div
      className="rounded-2xl px-5 py-4 flex flex-col gap-3"
      style={{
        background: 'rgba(8,13,19,.92)',
        border: '1px solid rgba(255,255,255,.13)',
        boxShadow: '0 10px 30px rgba(0,0,0,.4)',
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-extrabold tracking-wide" style={{ color: 'var(--mpl-title-yellow)' }}>
          다음 알림까지
        </span>
        <span className="flex-1" />
        {sync === 'pending' && (
          <span
            className="text-[12.5px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap"
            style={{ color: '#ffd76a', background: 'rgba(255,215,106,.14)', borderColor: 'rgba(255,215,106,.38)' }}
          >
            ⟳ 보정 중
          </span>
        )}
        <span
          className="text-[12.5px] font-extrabold px-2 py-0.5 rounded border"
          style={active
            ? { color: '#b6e77c', background: 'rgba(159,212,94,.16)', borderColor: 'rgba(159,212,94,.42)' }
            : { color: '#cfdae4', background: 'rgba(207,218,228,.12)', borderColor: 'rgba(207,218,228,.3)' }}
        >
          {active ? `● ${cycleIndex}회차` : '대기'}
        </span>
      </div>

      {remainingMs != null && remainingMs > 0 ? (
        <div
          className="font-extrabold tabular-nums leading-[.9]"
          style={{ fontSize: 64, letterSpacing: '-2.5px', color: '#eef3f8' }}
        >
          {formatSeconds(remainingMs).split('.')[0]}
          <span style={{ fontSize: 30, letterSpacing: 0 }}>.{formatSeconds(remainingMs).split('.')[1]}</span>
        </div>
      ) : (
        <div className="font-extrabold leading-[1.3]" style={{ fontSize: 38, color: '#8ba0b4' }}>
          {idleLabel}
        </div>
      )}

      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.12)' }}>
        <div
          className="h-full"
          style={{
            width: `${Math.min(100, Math.max(0, progress * 100))}%`,
            background: 'linear-gradient(90deg, var(--mpl-sky-from), var(--mpl-sky-to))',
          }}
        />
      </div>

      <div className="flex gap-2">
        <IconButton tone="slate" label="타이머 초기화 — 잘못 시작됐을 때" onClick={onReset}>
          <TimerResetIcon />
        </IconButton>
      </div>
    </div>
  )
}
