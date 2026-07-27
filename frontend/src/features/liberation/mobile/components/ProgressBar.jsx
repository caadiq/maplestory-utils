const DOW = ['일', '월', '화', '수', '목', '금', '토']
function formatKoreanDate(s) {
  const [y, m, d] = s.split('-')
  const dow = DOW[new Date(`${s}T00:00:00+09:00`).getDay()]
  return `${y}년 ${m}월 ${d}일 (${dow})`
}

function DateRow({ label, value }) {
  return (
    <div
      className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
      style={{
        background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
      }}
    >
      <span
        className="text-[11px] font-bold rounded-full px-2.5 py-0.5"
        style={{ background: 'rgba(255,255,255,.25)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.35)', color: '#ffffff' }}
      >
        {label}
      </span>
      <span className="text-sm font-bold tabular-nums" style={{ color: '#ffffff' }}>{value}</span>
    </div>
  )
}

export default function ProgressBar({
  chapters,
  imageBase,
  startChapter,
  currentPoints,
  completionDate,
  // 데스티니: 1차 해방(무기 전승) 날짜를 따로 표시 { done: bool, date: 'YYYY-MM-DD'|null }
  primaryCompletion = null,
}) {
  const chapterStates = chapters.map((c) => {
    if (c.idx < startChapter) return { chapter: c, status: 'done', current: c.required }
    if (c.idx === startChapter) {
      const filled = Math.min(currentPoints, c.required)
      return { chapter: c, status: 'active', current: filled }
    }
    return { chapter: c, status: 'pending', current: 0 }
  })

  return (
    <div
      className="rounded-2xl border p-4 space-y-3"
      style={{ background: 'var(--panel-bg)', borderColor: 'var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}
    >
      <div className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>퀘스트 진행 상황</div>

      {/* 1차 / 2차 분리 — 각 라벨 + 게이지 + 초상화 줄 */}
      {[1, 2].map((phase) => {
        const group = chapterStates.filter((s) => s.chapter.phase === phase)
        if (group.length === 0) return null
        const isPrimary = phase === 1
        return (
          <div key={phase} className={`space-y-2 ${phase === 2 && primaryCompletion ? 'pt-2' : ''}`}>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold rounded-full px-3 py-0.5 shrink-0"
                style={isPrimary ? {
                  background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
                  color: '#ffffff',
                } : {
                  background: 'var(--mpl-row)',
                  boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)',
                  color: 'var(--text-muted)',
                }}
              >
                {phase}차 해방
              </span>
              <div
                className="flex-1"
                style={{
                  height: 3,
                  borderRadius: 999,
                  background: isPrimary
                    ? 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))'
                    : 'var(--mpl-card-line)',
                }}
              />
            </div>
            <div className="flex gap-1">
              {group.map(({ chapter, status, current }) => {
                const pct = (current / chapter.required) * 100
                const bg = status === 'done'
                  ? 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))'
                  : status === 'active' ? 'linear-gradient(180deg, #ffd76e, #f0a828)' : 'transparent'
                return (
                  <div key={`seg-${chapter.idx}`} className="flex-1 h-1.5 rounded overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                    <div className="h-full transition-all" style={{ width: `${pct}%`, background: bg }} />
                  </div>
                )
              })}
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${group.length}, minmax(0, 1fr))` }}>
              {group.map(({ chapter, status }) => (
                <div key={`p-${chapter.idx}`} className="flex flex-col items-center gap-1 min-w-0">
                  <div
                    className={`w-full aspect-square rounded-md overflow-hidden ${status === 'pending' ? 'opacity-50' : ''}`}
                    style={status === 'active' ? { boxShadow: '0 0 0 2px #eec584, 0 2px 6px rgba(238,197,132,.5)' } : undefined}
                  >
                    <img
                      src={`${imageBase}/${chapter.boss}.webp`}
                      alt={chapter.boss}
                      className={`block w-full h-full object-cover ${status === 'pending' ? 'grayscale' : ''}`}
                    />
                  </div>
                  <div
                    className="text-[10px] font-medium leading-tight truncate max-w-full text-center"
                    style={{
                      color: status === 'done' ? 'var(--text-strong)' : status === 'active' ? '#9a6a10' : 'var(--text-dim)',
                    }}
                  >
                    {chapter.boss}
                  </div>
                </div>
              ))}
            </div>
            {primaryCompletion && (
              phase === 1 ? (
                <DateRow
                  label="1차 해방"
                  value={primaryCompletion.done ? '해방 완료' : primaryCompletion.date ? formatKoreanDate(primaryCompletion.date) : '미정'}
                />
              ) : (
                <DateRow label="2차 해방" value={completionDate ? formatKoreanDate(completionDate) : '미정'} />
              )
            )}
          </div>
        )
      })}

      {/* 예상 해방 날짜 (제네시스 — 단일 박스) */}
      {!primaryCompletion && (
        <div
          className="flex items-center justify-between rounded-xl px-3.5 py-2.5 mt-1"
          style={{
            background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25)',
          }}
        >
          <span
            className="text-[11px] font-bold rounded-full px-2.5 py-0.5"
            style={{ background: 'rgba(255,255,255,.25)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.35)', color: '#ffffff' }}
          >
            예상 해방 날짜
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color: '#ffffff' }}>
            {completionDate ? formatKoreanDate(completionDate) : '미정'}
          </span>
        </div>
      )}
    </div>
  )
}
