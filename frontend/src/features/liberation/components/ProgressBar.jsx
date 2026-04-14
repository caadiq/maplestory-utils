import { GENESIS_CHAPTERS, GENESIS_TOTAL, QUEST_BOSS_IMAGE_BASE } from '../data'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
function formatKoreanDate(s) {
  const [y, m, d] = s.split('-')
  const dow = DOW[new Date(`${s}T00:00:00+09:00`).getDay()]
  return `${y}년 ${m}월 ${d}일 (${dow})`
}

export default function ProgressBar({ startChapter, currentPoints, completionDate }) {
  const chapterStates = GENESIS_CHAPTERS.map((c) => {
    if (c.idx < startChapter) return { chapter: c, status: 'done', current: c.required }
    if (c.idx === startChapter) {
      const filled = Math.min(currentPoints, c.required)
      return { chapter: c, status: filled > 0 ? 'active' : 'active', current: filled }
    }
    return { chapter: c, status: 'pending', current: 0 }
  })

  const renderSegment = ({ chapter, status, current }) => {
    const pct = (current / chapter.required) * 100
    const bg = status === 'done' ? '#10b981' : status === 'active' ? '#fbbf24' : 'transparent'
    return (
      <div key={`seg-${chapter.idx}`} className="flex-1 h-2 rounded bg-gray-900 overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: bg }}
        />
      </div>
    )
  }

  const renderPortrait = ({ chapter, status }) => (
    <div key={`p-${chapter.idx}`} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
      <div className={`w-full aspect-square rounded-lg overflow-hidden transition ${
        status === 'active' ? 'shadow-lg shadow-amber-500/20' :
        status === 'pending' ? 'opacity-50' : ''
      }`}>
        <img
          src={`${QUEST_BOSS_IMAGE_BASE}/${chapter.boss}.png`}
          alt={chapter.boss}
          className={`block w-full h-full object-cover ${status === 'pending' ? 'grayscale' : ''}`}
        />
      </div>
      <div className={`text-sm font-medium ${
        status === 'done' ? 'text-emerald-300' :
        status === 'active' ? 'text-amber-300' : 'text-gray-500'
      }`}>
        {chapter.boss}
      </div>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 space-y-5">
      {/* 섹션 제목 */}
      <div className="text-lg font-semibold text-emerald-300">퀘스트 진행 상황</div>

      {/* 1차 / 2차 라벨 + 세그먼트 바 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex flex-col items-center gap-2">
            <span className="text-base font-bold" style={{ color: '#a78bfa' }}>1차 해방</span>
            <div style={{ width: '100%', height: 3, background: 'rgba(167, 139, 250, 0.5)', borderRadius: 999 }} />
          </div>
          <div className="flex-1 flex flex-col items-center gap-2">
            <span className="text-base font-bold" style={{ color: '#fda4af' }}>2차 해방</span>
            <div style={{ width: '100%', height: 3, background: 'rgba(253, 164, 175, 0.5)', borderRadius: 999 }} />
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
      <div className="flex items-center justify-center gap-3 pt-4 border-t border-white/5">
        <span className="text-lg font-semibold text-white">예상 해방 날짜</span>
        <span className="text-gray-600">·</span>
        <span className="text-xl font-bold tabular-nums text-amber-400">
          {completionDate ? formatKoreanDate(completionDate) : <span className="text-gray-500 font-normal">미정</span>}
        </span>
      </div>
    </div>
  )
}
