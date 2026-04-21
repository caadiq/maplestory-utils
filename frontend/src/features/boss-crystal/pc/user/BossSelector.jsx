import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import Select from '../../../../components/common/Select'
import StaggerGroup from '../../../../components/common/StaggerGroup'
import { DIFFICULTIES, formatMeso } from '../admin/constants'

const LABEL_EN = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD', chaos: 'CHAOS', extreme: 'EXTREME' }

export default function BossSelector({ characterName, bosses, selections, onChange, maxReached, selectedCount, maxPerCharacter }) {
  if (!characterName) {
    return (
      <div
        className="rounded-2xl border border-dashed p-16 text-center text-sm"
        style={{
          borderColor: 'var(--dashed-border)',
          background: 'var(--skeleton-bg)',
          color: 'var(--text-dim)',
        }}
      >
        좌측에서 캐릭터를 선택해주세요
      </div>
    )
  }

  if (bosses.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed p-16 text-center text-sm"
        style={{
          borderColor: 'var(--dashed-border)',
          background: 'var(--skeleton-bg)',
          color: 'var(--text-dim)',
        }}
      >
        등록된 보스가 없습니다
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border overflow-hidden flex flex-col h-full"
      style={{
        background: 'var(--panel-bg)',
        borderColor: 'var(--panel-border)',
        boxShadow: 'var(--panel-shadow)',
      }}
    >
      {/* 헤더 (고정) */}
      <div
        className="flex items-center gap-3 px-5 py-3 border-b text-base font-medium shrink-0"
        style={{
          background: 'var(--surface-2)',
          borderColor: 'var(--panel-border)',
          color: 'var(--text-emphasis)',
        }}
      >
        <div className="w-52 shrink-0">보스</div>
        <div className="flex-1">난이도</div>
        <div className="w-20 shrink-0 text-center">파티원 수</div>
        <div className="w-32 shrink-0 text-right">가격</div>
      </div>
      {/* 목록 (스크롤) */}
      <OverlayScrollbarsComponent
        className="flex-1 min-h-0"
        options={{
          scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 },
          overflow: { x: 'hidden', y: 'scroll' },
        }}
        defer
      >
        <StaggerGroup
          className="divide-y px-2"
          style={{ '--tw-divide-opacity': 1 }}
          staggerDelay={0.04}
          yOffset={20}
          duration={0.3}
        >
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
                className={`flex items-center gap-3 px-3 py-3 border-t first:border-t-0 ${
                  disabled ? 'pointer-events-none' : ''
                }`}
                style={{
                  borderColor: 'var(--panel-border)',
                  opacity: disabled ? 'var(--disabled-opacity)' : 1,
                }}
              >
                {/* 보스 이미지 + 이름 */}
                <div className="flex items-center gap-2.5 w-52 shrink-0">
                  <div
                    className="shrink-0 w-11 h-11 rounded-lg overflow-hidden"
                    style={{ background: 'var(--surface-nested)' }}
                  >
                    <img src={boss.image_url || '/default.png'} alt={boss.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-base font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{boss.name}</span>
                </div>

                {/* 난이도 - 한 줄 고정 */}
                <div className="flex-1 flex items-center gap-2 flex-nowrap min-w-0">
                  {availableDiffs.map((d) => {
                    const active = sel?.difficulty === d.key
                    const hasVisibleBorder = d.colors.border !== d.colors.bg
                    const borderColor = hasVisibleBorder ? d.colors.border : 'rgba(0, 0, 0, 0.55)'
                    const style = {
                      background: d.colors.bg,
                      borderColor,
                      borderWidth: '1.5px',
                      color: d.colors.text,
                      filter: active ? 'none' : 'var(--inactive-filter)',
                    }
                    return (
                      <button
                        key={d.key}
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.currentTarget.blur()
                          if (active) onChange(boss.id, null)
                          else onChange(boss.id, { difficulty: d.key, party: partyN })
                        }}
                        style={style}
                        className="shrink-0 rounded-full border-solid px-4 h-7 text-xs font-bold tracking-wider transition focus:outline-none"
                      >
                        {LABEL_EN[d.key] || d.key.toUpperCase()}
                      </button>
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
                    <div
                      className="text-xs text-center"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      -
                    </div>
                  )}
                </div>

                {/* 수익 */}
                <div
                  className="w-32 shrink-0 text-right text-sm font-medium tabular-nums"
                  style={{ color: sel ? 'var(--accent-bright)' : 'var(--text-dim)' }}
                >
                  {sel ? formatMeso(revenue) : '-'}
                </div>
              </div>
            )
          })}
        </StaggerGroup>
      </OverlayScrollbarsComponent>
    </div>
  )
}
