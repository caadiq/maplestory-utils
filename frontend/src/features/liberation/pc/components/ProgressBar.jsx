import { formatKoreanDate } from '../../../../utils/formatting'
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

  // 1차/2차 해방 라벨 폭 (phase 필드가 있으면 그 기준, 없으면 반반)
  const phase1Count = chapters.filter((c) => c.phase === 1).length || Math.ceil(chapters.length / 2)

  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: 'var(--mpl-card)', boxShadow: 'inset 0 0 0 1px var(--mpl-card-line)' }}
    >
      {/* 섹션 제목 */}
      <div className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>퀘스트 진행 상황</div>

      {/* 1차 / 2차 라벨 + 밑줄 바 */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center gap-1.5" style={{ flex: phase1Count }}>
          <span className="text-sm font-bold" style={{ color: 'var(--mpl-slate-to)' }}>1차 해방</span>
          <div style={{ width: '100%', height: 3, background: 'var(--mpl-card-line)', borderRadius: 999 }} />
        </div>
        <div className="flex flex-col items-center gap-1.5" style={{ flex: chapters.length - phase1Count }}>
          <span className="text-sm font-bold" style={{ color: 'var(--mpl-slate-to)' }}>2차 해방</span>
          <div style={{ width: '100%', height: 3, background: 'var(--mpl-card-line)', borderRadius: 999 }} />
        </div>
      </div>

      {/* 챕터 초상 + 개별 게이지 */}
      <div className="flex gap-2.5">
        {chapterStates.map(({ chapter, status, current }) => {
          const pct = chapter.required ? Math.min((current / chapter.required) * 100, 100) : 0
          return (
            <div key={chapter.idx} className="flex-1 min-w-0 text-center">
              <div
                className="w-full aspect-square rounded-[10px] overflow-hidden"
                style={status === 'active' ? { boxShadow: '0 0 0 3px #eec584' } : undefined}
              >
                <img
                  src={`${imageBase}/${chapter.boss}.webp`}
                  alt={chapter.boss}
                  className={`block w-full h-full object-cover ${status === 'pending' ? 'grayscale opacity-60' : ''}`}
                />
              </div>
              <div
                className="text-xs font-semibold mt-1.5 truncate"
                style={{
                  color: status === 'done' ? 'var(--accent-bright)' :
                         status === 'active' ? 'var(--warning-text-bright)' : 'var(--text-dim)',
                }}
              >
                {chapter.boss}
              </div>
              <div
                className="h-[7px] rounded-full overflow-hidden mt-1.5"
                style={{ background: 'var(--progress-track)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${status === 'done' ? 100 : pct}%`,
                    background: status === 'done'
                      ? 'linear-gradient(180deg, var(--mpl-lime-from), var(--mpl-lime-to))'
                      : 'linear-gradient(180deg, #ffd76e, #f0a828)',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* 예상 해방 날짜 */}
      {primaryCompletion ? (
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div
            className="rounded-xl px-5 py-3.5 text-white"
            style={{
              background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25), 0 4px 12px rgba(31,44,61,.25)',
            }}
          >
            <span
              className="inline-block rounded-full px-3 py-0.5 text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,.25)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.35)' }}
            >
              1차 해방
            </span>
            <div className="text-xl font-bold tabular-nums mt-1.5">
              {primaryCompletion.done
                ? '해방 완료'
                : primaryCompletion.date
                  ? formatKoreanDate(primaryCompletion.date)
                  : <span className="font-normal" style={{ color: 'rgba(255,255,255,.7)' }}>미정</span>}
            </div>
          </div>
          <div
            className="rounded-xl px-5 py-3.5 text-white"
            style={{
              background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25), 0 4px 12px rgba(31,44,61,.25)',
            }}
          >
            <span
              className="inline-block rounded-full px-3 py-0.5 text-[11px] font-semibold"
              style={{ background: 'rgba(255,255,255,.25)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.35)' }}
            >
              2차 해방
            </span>
            <div className="text-xl font-bold tabular-nums mt-1.5">
              {completionDate ? formatKoreanDate(completionDate) : <span className="font-normal" style={{ color: 'rgba(255,255,255,.7)' }}>미정</span>}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-xl px-5 py-3.5 text-white"
          style={{
            background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.25), 0 4px 12px rgba(31,44,61,.25)',
          }}
        >
          <span
            className="inline-block rounded-full px-3 py-0.5 text-[11px] font-semibold"
            style={{ background: 'rgba(255,255,255,.25)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.35)' }}
          >
            예상 해방 날짜
          </span>
          <div className="text-xl font-bold tabular-nums mt-1.5">
            {completionDate ? formatKoreanDate(completionDate) : <span className="font-normal" style={{ color: 'rgba(255,255,255,.7)' }}>미정</span>}
          </div>
        </div>
      )}
    </div>
  )
}
