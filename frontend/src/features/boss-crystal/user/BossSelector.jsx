import Select from '../../../components/Select'
import Tooltip from '../../../components/Tooltip'
import { DIFFICULTIES, formatMeso, getDifficultyImageUrl } from '../admin/constants'

export default function BossSelector({ characterName, bosses, selections, onChange, maxReached, selectedCount, maxPerCharacter }) {
  if (!characterName) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center text-sm text-gray-500">
        좌측에서 캐릭터를 선택해주세요
      </div>
    )
  }

  if (bosses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-16 text-center text-sm text-gray-500">
        등록된 보스가 없습니다
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-white/5 bg-gray-900/40 overflow-hidden flex flex-col h-full">
      {/* 헤더 (고정) */}
      <div className="flex items-center gap-3 px-3 py-3 bg-gray-950/60 border-b border-white/5 text-base font-semibold text-gray-300 shrink-0">
        <div className="w-52 shrink-0">보스</div>
        <div className="flex-1">난이도</div>
        <div className="w-20 shrink-0 text-center">파티원 수</div>
        <div className="w-32 shrink-0 text-right">가격</div>
      </div>
      {/* 목록 (스크롤) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="divide-y divide-white/5">
          {bosses.map((boss) => {
            const availableDiffs = DIFFICULTIES.filter((d) =>
              boss.difficulties.some((bd) => bd.difficulty === d.key)
            )
            const sel = selections[boss.id]
            const bdInfo = sel ? boss.difficulties.find((bd) => bd.difficulty === sel.difficulty) : null
            const partyN = sel?.party || 1
            const revenue = bdInfo ? Math.floor(bdInfo.crystal_price / partyN) : 0

            const partyOptions = Array.from({ length: boss.max_party_size }, (_, i) => i + 1).map((n) => ({
              value: n,
              label: `${n}인`,
            }))

            // 한도 도달 + 이 보스가 선택 안 됐으면 비활성화
            const disabled = maxReached && !sel

            return (
              <div
                key={boss.id}
                className={`flex items-center gap-3 px-3 py-3 transition ${
                  disabled ? 'opacity-30 pointer-events-none' : ''
                }`}
              >
                {/* 보스 이미지 + 이름 */}
                <div className="flex items-center gap-2.5 w-52 shrink-0">
                  <div className="shrink-0 w-11 h-11 rounded-lg bg-gray-900 overflow-hidden">
                    <img src={boss.image_url || '/default.png'} alt={boss.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-base font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{boss.name}</span>
                </div>

                {/* 난이도 - 한 줄 고정 */}
                <div className="flex-1 flex items-center gap-2 flex-nowrap min-w-0">
                  {availableDiffs.map((d) => {
                    const active = sel?.difficulty === d.key
                    return (
                      <Tooltip key={d.key} text={d.label}>
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={(e) => {
                            e.currentTarget.blur()
                            if (active) {
                              onChange(boss.id, null)
                            } else {
                              onChange(boss.id, { difficulty: d.key, party: partyN })
                            }
                          }}
                          className={`shrink-0 transition focus:outline-none ${active ? 'opacity-100 scale-105' : 'opacity-40 hover:opacity-70'}`}
                        >
                          <img src={getDifficultyImageUrl(d.key)} alt={d.label} className="h-5" />
                        </button>
                      </Tooltip>
                    )
                  })}
                </div>

                {/* 파티 인원 - 커스텀 Select */}
                <div className="w-20 shrink-0">
                  {sel ? (
                    <Select
                      value={partyN}
                      onChange={(val) => onChange(boss.id, { ...sel, party: val })}
                      options={partyOptions}
                      align="right"
                    />
                  ) : (
                    <div className="text-xs text-gray-700 text-center">-</div>
                  )}
                </div>

                {/* 수익 */}
                <div className={`w-32 shrink-0 text-right text-sm font-medium tabular-nums ${sel ? 'text-emerald-300' : 'text-gray-700'}`}>
                  {sel ? formatMeso(revenue) : '-'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
