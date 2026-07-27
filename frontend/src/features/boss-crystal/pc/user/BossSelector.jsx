import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import Select from '../../../../components/common/Select'
import { DIFFICULTIES, formatMeso } from '../admin/constants'
import { LABEL_EN, seasonBossesFor } from '../../logic'

export default function BossSelector({ characterName, worldName, bosses, selections, onChange, maxReached, onOpenPriceTable }) {
  // 시즌보스(챌린저스 월드 + 활성 시즌만) 먼저, 그 뒤 일반 보스
  const seasonBosses = seasonBossesFor(worldName, bosses)
  const normalBosses = bosses.filter((b) => !b.season)
  const visibleBosses = [...seasonBosses, ...normalBosses]

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
    <div className="flex flex-col h-full min-h-0">
      {/* 헤더 (청회색 필 바, 고정) */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold shrink-0"
        style={{
          background: 'linear-gradient(180deg, var(--mpl-slate-from), var(--mpl-slate-to))',
          color: '#ffffff',
          textShadow: '0 1px 1px rgba(44,55,69,.3)',
        }}
      >
        <div className="w-52 shrink-0">보스</div>
        <div className="flex-1">난이도</div>
        <div className="w-20 shrink-0 text-center">파티원 수</div>
        <div className="w-32 shrink-0 flex justify-end">
          <button
            type="button"
            onClick={onOpenPriceTable}
            title="보스·난이도별 전체 결정석 가격표 보기"
            className="inline-flex items-center gap-1.5 hover:brightness-90 transition"
          >
            가격
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M1.5 6H14.5M6 6V13.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </div>
      </div>
      {/* 목록 (스크롤) */}
      <OverlayScrollbarsComponent
        className="flex-1 min-h-0 -mr-3"
        options={{
          scrollbars: { theme: 'os-theme-maple os-theme-dark', autoHide: 'leave', autoHideDelay: 800 },
          overflow: { x: 'hidden', y: 'scroll' },
        }}
        defer
      >
        <div className="space-y-1.5 pr-3 pt-2">
          {visibleBosses.map((boss) => {
            const isSeason = !!boss.season
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

            // 한도 도달 + 이 보스가 선택 안 됐으면 비활성화 (시즌보스는 한도 미포함이라 제외)
            const disabled = maxReached && !sel && !isSeason

            return (
              <div
                key={boss.id}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-[10px] ${
                  disabled ? 'pointer-events-none' : ''
                }`}
                style={{
                  background: 'var(--mpl-card)',
                  boxShadow: isSeason
                    ? 'inset 0 0 0 1.5px #eec584'
                    : 'inset 0 0 0 1px var(--mpl-card-line)',
                  opacity: disabled ? 'var(--disabled-opacity)' : 1,
                }}
              >
                {/* 보스 이미지 + 이름 */}
                <div className="flex items-center gap-2.5 w-52 shrink-0">
                  <div
                    className="shrink-0 w-11 h-11 rounded-lg overflow-hidden"
                    style={{ background: 'var(--surface-nested)' }}
                  >
                    <img src={boss.image_url || '/default.png'} alt={boss.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </div>
                  <span className="text-base font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis">{boss.name}</span>
                  {isSeason && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                      style={{
                        background: 'linear-gradient(180deg, #f7dcab, #eec584)',
                        boxShadow: 'inset 0 0 0 1px #e3b878',
                        color: '#9a6a10',
                      }}
                    >
                      시즌
                    </span>
                  )}
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
                  className="w-32 shrink-0 text-right text-sm font-bold tabular-nums"
                  style={{ color: sel ? 'var(--accent-bright)' : 'var(--text-dim)' }}
                >
                  {sel ? formatMeso(revenue) : '-'}
                </div>
              </div>
            )
          })}
        </div>
      </OverlayScrollbarsComponent>
    </div>
  )
}
