import { GENESIS_CHAPTERS, GENESIS_TOTAL, QUEST_BOSS_IMAGE_BASE } from '../data'

function formatKoreanDate(s) {
  const [y, m, d] = s.split('-')
  return `${y}년 ${m}월 ${d}일`
}

export default function ProgressBar({ totalAccumulated, completionDate }) {
  const chapterStates = []
  let remaining = totalAccumulated
  for (const c of GENESIS_CHAPTERS) {
    if (remaining >= c.required) {
      chapterStates.push({ chapter: c, status: 'done', current: c.required })
      remaining -= c.required
    } else if (remaining > 0) {
      chapterStates.push({ chapter: c, status: 'active', current: remaining })
      remaining = 0
    } else {
      chapterStates.push({ chapter: c, status: 'pending', current: 0 })
    }
  }

  const renderSegment = ({ chapter, status, current }) => {
    const pct = (current / chapter.required) * 100
    return (
      <div key={`seg-${chapter.idx}`} className="flex-1 h-2 rounded bg-gray-900 overflow-hidden">
        <div
          className={`h-full transition-all ${
            status === 'done' ? 'bg-emerald-500' :
            status === 'active' ? 'bg-amber-400' : 'bg-transparent'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    )
  }

  const renderPortrait = ({ chapter, status }) => (
    <div key={`p-${chapter.idx}`} className="flex-1 flex flex-col items-center gap-1.5">
      <div className={`w-14 h-14 rounded-lg overflow-hidden border transition ${
        status === 'done' ? 'border-emerald-500/40' :
        status === 'active' ? 'border-amber-400/60 shadow-lg shadow-amber-500/20' :
        'border-white/5 opacity-50'
      }`}>
        <img
          src={`${QUEST_BOSS_IMAGE_BASE}/${chapter.boss}.png`}
          alt={chapter.boss}
          className={`w-full h-full object-cover ${status === 'pending' ? 'grayscale' : ''}`}
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
    <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-gray-900/60 p-6 space-y-5">
      {/* 섹션 제목 */}
      <div className="text-lg font-semibold text-emerald-300">퀘스트 진행 상황</div>

      {/* 1차 / 2차 라벨 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex flex-col items-center gap-2">
          <span className="text-base font-bold" style={{ color: '#5eead4' }}>1차 해방</span>
          <div style={{ width: '100%', height: 3, background: 'rgba(94, 234, 212, 0.5)', borderRadius: 999 }} />
        </div>
        <div className="w-2" />
        <div className="flex-1 flex flex-col items-center gap-2">
          <span className="text-base font-bold" style={{ color: '#fda4af' }}>2차 해방</span>
          <div style={{ width: '100%', height: 3, background: 'rgba(253, 164, 175, 0.5)', borderRadius: 999 }} />
        </div>
      </div>

      {/* 세그먼트 바 (붙어있음) */}
      <div className="flex gap-1">
        {chapterStates.map(renderSegment)}
      </div>

      {/* 초상화 (붙어있음) */}
      <div className="flex gap-1">
        {chapterStates.map(renderPortrait)}
      </div>

      {/* 예상 해방 날짜 */}
      <div className="flex items-center justify-center gap-2 pt-4 border-t border-white/5 text-base">
        <span className="text-emerald-300/80">예상 해방 날짜</span>
        <span className="text-gray-600">·</span>
        <span className="font-semibold tabular-nums text-amber-400">
          {completionDate ? formatKoreanDate(completionDate) : <span className="text-gray-500 font-normal">미정</span>}
        </span>
      </div>
    </div>
  )
}
