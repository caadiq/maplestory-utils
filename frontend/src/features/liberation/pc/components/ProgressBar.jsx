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
}) {
  const chapterStates = chapters.map((c) => {
    if (c.idx < startChapter) return { chapter: c, status: 'done', current: c.required }
    if (c.idx === startChapter) {
      const filled = Math.min(currentPoints, c.required)
      return { chapter: c, status: 'active', current: filled }
    }
    return { chapter: c, status: 'pending', current: 0 }
  })

  const renderSegment = ({ chapter, status, current }) => {
    const pct = (current / chapter.required) * 100
    const bg = status === 'done' ? 'var(--progress-emerald)' : status === 'active' ? 'var(--progress-amber)' : 'transparent'
    return (
      <div
        key={`seg-${chapter.idx}`}
        className="flex-1 h-2 rounded overflow-hidden"
        style={{ background: 'var(--progress-track)' }}
      >
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: bg }}
        />
      </div>
    )
  }

  const renderPortrait = ({ chapter, status }) => (
    <div key={`p-${chapter.idx}`} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
      <div className={`w-full aspect-square rounded-lg overflow-hidden ${
        status === 'active' ? 'shadow-lg shadow-amber-500/20' :
        status === 'pending' ? 'opacity-50' : ''
      }`}>
        <img
          src={`${imageBase}/${chapter.boss}.webp`}
          alt={chapter.boss}
          className={`block w-full h-full object-cover ${status === 'pending' ? 'grayscale' : ''}`}
        />
      </div>
      <div
        className="text-sm font-medium"
        style={{
          color: status === 'done' ? 'var(--accent-bright)' :
                 status === 'active' ? 'var(--warning-text-bright)' : 'var(--text-dim)',
        }}
      >
        {chapter.boss}
      </div>
    </div>
  )

  return (
    <div
      className="max-w-3xl mx-auto rounded-2xl border p-6 space-y-5"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
      }}
    >
      {/* 섹션 제목 */}
      <div className="text-lg font-semibold" style={{ color: 'var(--accent-bright)' }}>퀘스트 진행 상황</div>

      {/* 1차 / 2차 라벨 + 세그먼트 바 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex flex-col items-center gap-2">
            <span className="text-base font-bold" style={{ color: 'var(--liberation-primary)' }}>1차 해방</span>
            <div style={{ width: '100%', height: 3, background: 'var(--liberation-primary-bar)', borderRadius: 999 }} />
          </div>
          <div className="flex-1 flex flex-col items-center gap-2">
            <span className="text-base font-bold" style={{ color: 'var(--liberation-secondary)' }}>2차 해방</span>
            <div style={{ width: '100%', height: 3, background: 'var(--liberation-secondary-bar)', borderRadius: 999 }} />
          </div>
        </div>
        <div className="flex gap-2">
          {chapterStates.map(renderSegment)}
        </div>
      </div>

      {/* 초상화 (붙어있음) */}
      <div className="flex gap-2">
        {chapterStates.map(renderPortrait)}
      </div>

      {/* 예상 해방 날짜 */}
      <div
        className="flex items-center justify-center gap-3 pt-4 border-t"
        style={{ borderColor: 'var(--panel-border)' }}
      >
        <span className="text-lg font-semibold" style={{ color: 'var(--text-strong)' }}>예상 해방 날짜</span>
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span
          className="text-xl font-bold tabular-nums"
          style={{ color: completionColor }}
        >
          {completionDate ? formatKoreanDate(completionDate) : <span className="font-normal" style={{ color: 'var(--text-dim)' }}>미정</span>}
        </span>
      </div>
    </div>
  )
}
