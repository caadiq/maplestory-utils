const DOW = ['일', '월', '화', '수', '목', '금', '토']
function formatKoreanDate(s) {
  const [y, m, d] = s.split('-')
  const dow = DOW[new Date(`${s}T00:00:00+09:00`).getDay()]
  return `${y}년 ${m}월 ${d}일 (${dow})`
}

export default function ProgressBar({
  chapters,
  imageBase,
  startChapter,
  currentPoints,
  completionDate,
  completionColor = 'var(--warning-text-bright)',
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
      <div className="text-base font-semibold" style={{ color: 'var(--accent-bright)' }}>퀘스트 진행 상황</div>

      {/* 1차 / 2차 라벨 + 세그먼트 바 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-bold" style={{ color: 'var(--liberation-primary)' }}>1차 해방</span>
            <div style={{ width: '100%', height: 2, background: 'var(--liberation-primary-bar)', borderRadius: 999 }} />
          </div>
          <div className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-bold" style={{ color: 'var(--liberation-secondary)' }}>2차 해방</span>
            <div style={{ width: '100%', height: 2, background: 'var(--liberation-secondary-bar)', borderRadius: 999 }} />
          </div>
        </div>
        <div className="flex gap-1">
          {chapterStates.map(({ chapter, status, current }) => {
            const pct = (current / chapter.required) * 100
            const bg = status === 'done' ? 'var(--progress-emerald)' : status === 'active' ? 'var(--progress-amber)' : 'transparent'
            return (
              <div key={`seg-${chapter.idx}`} className="flex-1 h-1.5 rounded overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                <div className="h-full transition-all" style={{ width: `${pct}%`, background: bg }} />
              </div>
            )
          })}
        </div>
      </div>

      {/* 초상화 (작게) */}
      <div className="flex gap-1">
        {chapterStates.map(({ chapter, status }) => (
          <div key={`p-${chapter.idx}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className={`w-full aspect-square rounded-md overflow-hidden ${
              status === 'active' ? 'ring-2 ring-amber-400/50' : status === 'pending' ? 'opacity-50' : ''
            }`}>
              <img
                src={`${imageBase}/${chapter.boss}.webp`}
                alt={chapter.boss}
                className={`block w-full h-full object-cover ${status === 'pending' ? 'grayscale' : ''}`}
              />
            </div>
            <div
              className="text-[9px] font-medium leading-tight truncate max-w-full text-center"
              style={{
                color: status === 'done' ? 'var(--accent-bright)' : status === 'active' ? 'var(--warning-text-bright)' : 'var(--text-dim)',
              }}
            >
              {chapter.boss}
            </div>
          </div>
        ))}
      </div>

      {/* 예상 해방 날짜 */}
      {primaryCompletion ? (
        <div className="space-y-2 pt-3 border-t" style={{ borderColor: 'var(--panel-border)' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--liberation-primary)' }}>1차 해방</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: completionColor }}>
              {primaryCompletion.done
                ? <span style={{ color: 'var(--accent-bright)' }}>해방 완료</span>
                : primaryCompletion.date
                  ? formatKoreanDate(primaryCompletion.date)
                  : <span className="font-normal" style={{ color: 'var(--text-dim)' }}>미정</span>}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--liberation-secondary)' }}>2차 해방</span>
            <span className="text-sm font-bold tabular-nums" style={{ color: completionColor }}>
              {completionDate ? formatKoreanDate(completionDate) : <span className="font-normal" style={{ color: 'var(--text-dim)' }}>미정</span>}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 pt-3 border-t" style={{ borderColor: 'var(--panel-border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-strong)' }}>예상 해방 날짜</span>
          <span style={{ color: 'var(--text-dim)' }}>·</span>
          <span className="text-base font-bold tabular-nums" style={{ color: completionColor }}>
            {completionDate ? formatKoreanDate(completionDate) : <span className="font-normal" style={{ color: 'var(--text-dim)' }}>미정</span>}
          </span>
        </div>
      )}
    </div>
  )
}
